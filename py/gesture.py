# -*- coding: gbk -*-
import base64
import urllib
import requests
import cv2
import numpy as np
import time
import threading
from flask import Flask, jsonify
from flask_cors import CORS

API_KEY = "TXP78Imw38Jn3BTWcy9RClYM"
SECRET_KEY = "Pn2oKHbt24GZlZVhkUF5OuDMsUSCE61x"

app = Flask(__name__)
CORS(app)  # 允许所有来源的跨域请求
# 全局状态
gesture_control_enabled = False
last_gesture = None
last_gesture_time = 0

def main():
    # 启动Flask服务器
    flask_thread = threading.Thread(target=run_flask_server)
    flask_thread.daemon = True
    flask_thread.start()

    # 初始化摄像头
    cap = cv2.VideoCapture(0)

    # 设置识别间隔时间（秒）
    recognition_interval = 1  # 每秒识别一次
    last_recognition_time = 0

    while True:
        # 读取摄像头帧
        ret, frame = cap.read()
        if not ret:
            print("无法获取摄像头画面")
            break

        current_time = time.time()

        # 自动识别（按固定时间间隔）
        if current_time - last_recognition_time > recognition_interval and gesture_control_enabled:
            # 将帧转换为base64
            _, img_encoded = cv2.imencode('.jpg', frame)
            img_base64 = base64.b64encode(img_encoded).decode('utf-8')

            # 调用手势识别API
            result = recognize_gesture(img_base64)
            print("识别结果:", result)

            # 处理识别结果
            if result and 'result' in result:
                for item in result['result']:
                    classname = item['classname']
                    probability = item['probability']

                    # 只处理高置信度的手势
                    if probability > 0.6:
                        global last_gesture, last_gesture_time
                        last_gesture = classname
                        last_gesture_time = time.time()
                        print(f"检测到手势: {classname} (置信度: {probability:.2f})")

            last_recognition_time = current_time

        # 显示画面
        cv2.imshow('Gesture Recognition', frame)

        # 按'q'键退出
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # 释放资源
    cap.release()
    cv2.destroyAllWindows()

def recognize_gesture(image_base64):
    url = "https://aip.baidubce.com/rest/2.0/image-classify/v1/gesture?access_token=" + get_access_token()

    payload = f'image={urllib.parse.quote_plus(image_base64)}'
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    }

    response = requests.post(url, headers=headers, data=payload)
    return response.json()

def get_access_token():
    """
    使用 AK，SK 生成鉴权签名（Access Token）
    :return: access_token，或是None(如果错误)
    """
    url = "https://aip.baidubce.com/oauth/2.0/token"
    params = {"grant_type": "client_credentials", "client_id": API_KEY, "client_secret": SECRET_KEY}
    return str(requests.post(url, params=params).json().get("access_token"))

@app.route('/gesture/status', methods=['GET'])
def get_gesture_status():
    global gesture_control_enabled
    return jsonify({
        'enabled': gesture_control_enabled,
        'last_gesture': last_gesture,
        'last_gesture_time': last_gesture_time
    })

@app.route('/gesture/toggle', methods=['POST'])
def toggle_gesture_control():
    global gesture_control_enabled
    gesture_control_enabled = not gesture_control_enabled
    print(f"手势控制状态已切换: {'启用' if gesture_control_enabled else '禁用'}")
    return jsonify({'enabled': gesture_control_enabled})

def run_flask_server():
    app.run(port=5000)  # 使用5000端口，避免与apiService.py的8080冲突

if __name__ == '__main__':
    main()