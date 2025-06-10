# -*- coding: gbk -*-
import cv2
import mediapipe as mp
import math
import time
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ȫ��״̬
gesture_control_enabled = False
last_gestures = None
last_gesture_time = 0

# ������ָ��ɫ
FINGER_COLORS = {
    'thumb': (255, 0, 0),    # ��ɫ - ��Ĵָ
    'index': (0, 255, 0),    # ��ɫ - ʳָ
    'middle': (0, 0, 255),   # ��ɫ - ��ָ
    'ring': (255, 255, 0),   # ��ɫ - ����ָ
    'pinky': (255, 0, 255)   # ��ɫ - Сָ
}

class HandGestureRecognizer:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,  # ֧��˫��
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5)

        self.mp_drawing = mp.solutions.drawing_utils

        # �����ж�
        self.directions = {
            (315, 360): "Right",
            (0, 45): "Right",
            (45, 135): "Up",
            (135, 225): "Left",
            (225, 315): "Down"
        }

        # ʵʱ����״̬
        self.current_gestures = []
        self.current_directions = []
        self.gesture_start_time = 0
        self.gesture_hold_threshold = 0.3  # ���Ʊ�����ֵ(��)

        # ��ָ��ֱ��ֵ
        self.finger_straight_threshold = 20  # ��ָ�����Ƕ���ֵ(��)

    def is_finger_straight(self, tip, pip, mcp):
        """�ж���ָ�Ƿ���ֱ(ͨ������ؽڼ�ĽǶ�)"""
        # ���� PIP-MCP �� TIP-PIP ��������
        vec1 = (pip.x - mcp.x, pip.y - mcp.y)
        vec2 = (tip.x - pip.x, tip.y - pip.y)

        # ������������֮��ĽǶ�(��)
        angle = math.atan2(vec2[1], vec2[0]) - math.atan2(vec1[1], vec1[0])
        angle_deg = abs(math.degrees(angle)) % 360

        # ���Ƕ�С����ֵʱ��Ϊ��ָ����ֱ״̬
        return angle_deg < self.finger_straight_threshold or angle_deg > (360 - self.finger_straight_threshold)

    def get_gesture(self, frame, hand_landmarks):
        """ʶ��ǰ����"""
        landmarks = hand_landmarks.landmark

        # 1. ��ָ��ֱ״̬(����Ĵָ��)
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

        # ��Ĵָ
        thumb_tip = landmarks[self.mp_hands.HandLandmark.THUMB_TIP]
        thumb_ip = landmarks[self.mp_hands.HandLandmark.THUMB_IP]
        thumb_mcp = landmarks[self.mp_hands.HandLandmark.THUMB_MCP]
        thumb_bent = not self.is_finger_straight(thumb_tip, thumb_ip, thumb_mcp)
        fingers.append(not thumb_bent)  # ��Ĵָ��ֱΪTrue

        fingers_count = sum(fingers)

        # ȭͷ(0ָ��ֱ)
        if fingers_count == 0:
            return "Fist", None

        # �ſ�����(5ָ��ֱ)
        if fingers_count == 5:
            return "Five", None

        # 2. ֻ��ʳָ��ֱʱ�жϷ���
        index_tip = landmarks[self.mp_hands.HandLandmark.INDEX_FINGER_TIP]
        index_mcp = landmarks[self.mp_hands.HandLandmark.INDEX_FINGER_MCP]

        # ����Ƿ�ֻ��ʳָ��ֱ
        if not fingers[0]:  # ��һָ��ʳָ
            return None, None

        # 3. ʳָ����
        # ת��Ϊ��Ļ����(Y������)
        vec_x = index_tip.x - index_mcp.x
        vec_y = -(index_tip.y - index_mcp.y)

        angle_deg = math.degrees(math.atan2(vec_y, vec_x)) % 360

        for (min_deg, max_deg), direction in self.directions.items():
            if min_deg <= angle_deg < max_deg:
                return "Point", direction

        return "Point", "Unknown"

    def get_current_gestures(self):
        """��ȡ��ǰ��Ч����(ʱ�䳬����ֵ)"""
        if (time.time() - self.gesture_start_time) >= self.gesture_hold_threshold:
            return self.current_gestures, self.current_directions
        return [], []

    def draw_finger(self, frame, landmarks, finger_tip, finger_pip, finger_mcp, finger_dip, color):
        """���Ƶ�����ָ"""
        # ��ȡ��ָ�ؼ�������
        h, w, _ = frame.shape
        tip = (int(landmarks[finger_tip].x * w), int(landmarks[finger_tip].y * h))
        dip = (int(landmarks[finger_dip].x * w), int(landmarks[finger_dip].y * h))
        pip = (int(landmarks[finger_pip].x * w), int(landmarks[finger_pip].y * h))
        mcp = (int(landmarks[finger_mcp].x * w), int(landmarks[finger_mcp].y * h))

        # ������ָ����
        cv2.line(frame, tip, dip, color, 3)
        cv2.line(frame, dip, pip, color, 3)
        cv2.line(frame, pip, mcp, color, 3)

        # ���ƹؽ�
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
                # ���Ʋ�ͬ��ɫ����ָ
                landmarks = hand_landmarks.landmark

                # ��Ĵָ
                self.draw_finger(frame, landmarks,
                                 self.mp_hands.HandLandmark.THUMB_TIP,
                                 self.mp_hands.HandLandmark.THUMB_IP,
                                 self.mp_hands.HandLandmark.THUMB_MCP,
                                 self.mp_hands.HandLandmark.THUMB_TIP,  # ��Ĵָû��DIP
                                 FINGER_COLORS['thumb'])

                # ʳָ
                self.draw_finger(frame, landmarks,
                                 self.mp_hands.HandLandmark.INDEX_FINGER_TIP,
                                 self.mp_hands.HandLandmark.INDEX_FINGER_PIP,
                                 self.mp_hands.HandLandmark.INDEX_FINGER_MCP,
                                 self.mp_hands.HandLandmark.INDEX_FINGER_DIP,
                                 FINGER_COLORS['index'])

                # ��ָ
                self.draw_finger(frame, landmarks,
                                 self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP,
                                 self.mp_hands.HandLandmark.MIDDLE_FINGER_PIP,
                                 self.mp_hands.HandLandmark.MIDDLE_FINGER_MCP,
                                 self.mp_hands.HandLandmark.MIDDLE_FINGER_DIP,
                                 FINGER_COLORS['middle'])

                # ����ָ
                self.draw_finger(frame, landmarks,
                                 self.mp_hands.HandLandmark.RING_FINGER_TIP,
                                 self.mp_hands.HandLandmark.RING_FINGER_PIP,
                                 self.mp_hands.HandLandmark.RING_FINGER_MCP,
                                 self.mp_hands.HandLandmark.RING_FINGER_DIP,
                                 FINGER_COLORS['ring'])

                # Сָ
                self.draw_finger(frame, landmarks,
                                 self.mp_hands.HandLandmark.PINKY_TIP,
                                 self.mp_hands.HandLandmark.PINKY_PIP,
                                 self.mp_hands.HandLandmark.PINKY_MCP,
                                 self.mp_hands.HandLandmark.PINKY_DIP,
                                 FINGER_COLORS['pinky'])

                # ���������
                wrist = landmarks[self.mp_hands.HandLandmark.WRIST]
                wrist_pos = (int(wrist.x * frame.shape[1]), int(wrist.y * frame.shape[0]))
                cv2.circle(frame, wrist_pos, 8, (255, 255, 255), -1)

                gesture, direction = self.get_gesture(frame, hand_landmarks)
                if gesture:  # ֻ����Ч���Ʋż�¼
                    current_gestures.append(gesture)
                    current_directions.append(direction)

                # ��ʾʶ����
                text_pos = (wrist_pos[0], wrist_pos[1] - 20)
                display_text = gesture
                if direction:
                    display_text += f" | {direction}"

                cv2.putText(frame, display_text, text_pos,
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

        # ���µ�ǰ״̬
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
    print(f"���ƿ���״̬�л�: {'����' if gesture_control_enabled else '����'}")
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

        # ����ȫ��״̬
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
    # ����Flask������
    flask_thread = threading.Thread(target=app.run, kwargs={'port': 5000})
    flask_thread.daemon = True
    flask_thread.start()

    main()