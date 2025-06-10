# -*- coding: gbk -*-
import cv2
import mediapipe as mp
import math
import time
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 全局状态
gesture_control_enabled = False
last_gestures = None
last_gesture_time = 0

# 定义手指颜色
FINGER_COLORS = {
    'thumb': (255, 0, 0),    # 红色 - 大拇指
    'index': (0, 255, 0),    # 绿色 - 食指
    'middle': (0, 0, 255),   # 蓝色 - 中指
    'ring': (255, 255, 0),   # 青色 - 无名指
    'pinky': (255, 0, 255)   # 紫色 - 小指
}

class HandGestureRecognizer:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,  # 支持双手
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5)

        self.mp_drawing = mp.solutions.drawing_utils

        # 方向判断
        self.directions = {
            (315, 360): "Right",
            (0, 45): "Right",
            (45, 135): "Up",
            (135, 225): "Left",
            (225, 315): "Down"
        }

        # 实时手势状态
        self.current_gestures = []
        self.current_directions = []
        self.gesture_start_time = 0
        self.gesture_hold_threshold = 0.3  # 手势保持阈值(秒)

        # 手指伸直阈值
        self.finger_straight_threshold = 20  # 手指弯曲角度阈值(度)

    def is_finger_straight(self, tip, pip, mcp):
        """判断手指是否伸直(通过计算关节间的角度)"""
        # 计算 PIP-MCP 和 TIP-PIP 两个向量
        vec1 = (pip.x - mcp.x, pip.y - mcp.y)
        vec2 = (tip.x - pip.x, tip.y - pip.y)

        # 计算两个向量之间的角度(度)
        angle = math.atan2(vec2[1], vec2[0]) - math.atan2(vec1[1], vec1[0])
        angle_deg = abs(math.degrees(angle)) % 360

        # 当角度小于阈值时认为手指是伸直状态
        return angle_deg < self.finger_straight_threshold or angle_deg > (360 - self.finger_straight_threshold)

    def get_gesture(self, frame, hand_landmarks):
        """识别当前手势"""
        landmarks = hand_landmarks.landmark

        # 1. 手指伸直状态(除大拇指外)
        fingers = []
        finger_joints = [
            (self.mp_hands.HandLandmark.INDEX_FINGER_TIP,
             self.mp_hands.HandLandmark.INDEX_FINGER_PIP,
             self.mp_hands.HandLandmark.INDEX_FINGER_MCP),

            (self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP,
             self.mp_hands.HandLandmark.MIDDLE_FINGER_PIP,
             self.mp_hands.HandLandmark.MIDDLE_FINGER_MCP),

            (self.mp_hands.HandLandmark.RING_FINGER_TIP,
             self.mp_hands.HandLandmark.RING_FINGER_PIP,
             self.mp_hands.HandLandmark.RING_FINGER_MCP),

            (self.mp_hands.HandLandmark.PINKY_TIP,
             self.mp_hands.HandLandmark.PINKY_PIP,
             self.mp_hands.HandLandmark.PINKY_MCP)
        ]

        for tip, pip, mcp in finger_joints:
            fingers.append(self.is_finger_straight(
                landmarks[tip], landmarks[pip], landmarks[mcp]
            ))

        # 大拇指
        thumb_tip = landmarks[self.mp_hands.HandLandmark.THUMB_TIP]
        thumb_ip = landmarks[self.mp_hands.HandLandmark.THUMB_IP]
        thumb_mcp = landmarks[self.mp_hands.HandLandmark.THUMB_MCP]
        thumb_bent = not self.is_finger_straight(thumb_tip, thumb_ip, thumb_mcp)
        fingers.append(not thumb_bent)  # 大拇指伸直为True

        fingers_count = sum(fingers)

        # 拳头(0指伸直)
        if fingers_count == 0:
            return "Fist", None

        # 张开手掌(5指伸直)
        if fingers_count == 5:
            return "Five", None

        # 2. 只有食指伸直时判断方向
        index_tip = landmarks[self.mp_hands.HandLandmark.INDEX_FINGER_TIP]
        index_mcp = landmarks[self.mp_hands.HandLandmark.INDEX_FINGER_MCP]

        # 检查是否只有食指伸直
        if not fingers[0]:  # 第一指是食指
            return None, None

        # 3. 食指方向
        # 转换为屏幕坐标(Y轴向上)
        vec_x = index_tip.x - index_mcp.x
        vec_y = -(index_tip.y - index_mcp.y)

        angle_deg = math.degrees(math.atan2(vec_y, vec_x)) % 360

        for (min_deg, max_deg), direction in self.directions.items():
            if min_deg <= angle_deg < max_deg:
                return "Point", direction

        return "Point", "Unknown"

    def get_current_gestures(self):
        """获取当前有效手势(时间超过阈值)"""
        if (time.time() - self.gesture_start_time) >= self.gesture_hold_threshold:
            return self.current_gestures, self.current_directions
        return [], []

    def draw_finger(self, frame, landmarks, finger_tip, finger_pip, finger_mcp, finger_dip, color):
        """绘制单个手指"""
        # 获取手指关键点坐标
        h, w, _ = frame.shape
        tip = (int(landmarks[finger_tip].x * w), int(landmarks[finger_tip].y * h))
        dip = (int(landmarks[finger_dip].x * w), int(landmarks[finger_dip].y * h))
        pip = (int(landmarks[finger_pip].x * w), int(landmarks[finger_pip].y * h))
        mcp = (int(landmarks[finger_mcp].x * w), int(landmarks[finger_mcp].y * h))

        # 绘制手指骨骼
        cv2.line(frame, tip, dip, color, 3)
        cv2.line(frame, dip, pip, color, 3)
        cv2.line(frame, pip, mcp, color, 3)

        # 绘制关节
        cv2.circle(frame, tip, 5, color, -1)
        cv2.circle(frame, dip, 5, color, -1)
        cv2.circle(frame, pip, 5, color, -1)
        cv2.circle(frame, mcp, 5, color, -1)

    def process_frame(self, frame):
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(frame_rgb)

        current_gestures = []
        current_directions = []

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                # 绘制不同颜色的手指
                landmarks = hand_landmarks.landmark

                # 大拇指
                self.draw_finger(frame, landmarks,
                                 self.mp_hands.HandLandmark.THUMB_TIP,
                                 self.mp_hands.HandLandmark.THUMB_IP,
                                 self.mp_hands.HandLandmark.THUMB_MCP,
                                 self.mp_hands.HandLandmark.THUMB_TIP,  # 大拇指没有DIP
                                 FINGER_COLORS['thumb'])

                # 食指
                self.draw_finger(frame, landmarks,
                                 self.mp_hands.HandLandmark.INDEX_FINGER_TIP,
                                 self.mp_hands.HandLandmark.INDEX_FINGER_PIP,
                                 self.mp_hands.HandLandmark.INDEX_FINGER_MCP,
                                 self.mp_hands.HandLandmark.INDEX_FINGER_DIP,
                                 FINGER_COLORS['index'])

                # 中指
                self.draw_finger(frame, landmarks,
                                 self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP,
                                 self.mp_hands.HandLandmark.MIDDLE_FINGER_PIP,
                                 self.mp_hands.HandLandmark.MIDDLE_FINGER_MCP,
                                 self.mp_hands.HandLandmark.MIDDLE_FINGER_DIP,
                                 FINGER_COLORS['middle'])

                # 无名指
                self.draw_finger(frame, landmarks,
                                 self.mp_hands.HandLandmark.RING_FINGER_TIP,
                                 self.mp_hands.HandLandmark.RING_FINGER_PIP,
                                 self.mp_hands.HandLandmark.RING_FINGER_MCP,
                                 self.mp_hands.HandLandmark.RING_FINGER_DIP,
                                 FINGER_COLORS['ring'])

                # 小指
                self.draw_finger(frame, landmarks,
                                 self.mp_hands.HandLandmark.PINKY_TIP,
                                 self.mp_hands.HandLandmark.PINKY_PIP,
                                 self.mp_hands.HandLandmark.PINKY_MCP,
                                 self.mp_hands.HandLandmark.PINKY_DIP,
                                 FINGER_COLORS['pinky'])

                # 绘制手腕点
                wrist = landmarks[self.mp_hands.HandLandmark.WRIST]
                wrist_pos = (int(wrist.x * frame.shape[1]), int(wrist.y * frame.shape[0]))
                cv2.circle(frame, wrist_pos, 8, (255, 255, 255), -1)

                gesture, direction = self.get_gesture(frame, hand_landmarks)
                if gesture:  # 只有有效手势才记录
                    current_gestures.append(gesture)
                    current_directions.append(direction)

                # 显示识别结果
                text_pos = (wrist_pos[0], wrist_pos[1] - 20)
                display_text = gesture
                if direction:
                    display_text += f" | {direction}"

                cv2.putText(frame, display_text, text_pos,
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

        # 更新当前状态
        if current_gestures != self.current_gestures:
            self.current_gestures = current_gestures
            self.current_directions = current_directions
            self.gesture_start_time = time.time()

        return current_gestures, current_directions

@app.route('/gesture/status', methods=['GET'])
def get_gesture_status():
    return jsonify({
        'enabled': gesture_control_enabled,
        'last_gestures': last_gestures,
        'last_gesture_time': last_gesture_time
    })

@app.route('/gesture/current', methods=['GET'])
def get_current_gesture():
    gestures, directions = recognizer.get_current_gestures()
    if gestures:
        return jsonify({
            'gestures': gestures,
            'directions': directions,
            'timestamp': time.time()
        })
    return jsonify({'gestures': []})

@app.route('/gesture/toggle', methods=['POST'])
def toggle_gesture_control():
    global gesture_control_enabled
    gesture_control_enabled = not gesture_control_enabled
    print(f"手势控制状态切换: {'启用' if gesture_control_enabled else '禁用'}")
    return jsonify({'enabled': gesture_control_enabled})

def main():
    global recognizer, last_gestures, last_gesture_time
    recognizer = HandGestureRecognizer()
    cap = cv2.VideoCapture(0)

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        gestures, directions = recognizer.process_frame(frame)

        # 更新全局状态
        if gestures and gesture_control_enabled:
            current_time = time.time()
            last_gestures = gestures
            last_gesture_time = current_time

        cv2.imshow('Hand Gesture Recognition', frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    import threading
    # 启动Flask服务器
    flask_thread = threading.Thread(target=app.run, kwargs={'port': 5000})
    flask_thread.daemon = True
    flask_thread.start()

    main()