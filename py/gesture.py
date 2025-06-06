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
CORS(app)  # ����������Դ�Ŀ�������
# ȫ��״̬
gesture_control_enabled = False
last_gesture = None
last_gesture_time = 0

def main():
    # ����Flask������
    flask_thread = threading.Thread(target=run_flask_server)
    flask_thread.daemon = True
    flask_thread.start()

    # ��ʼ������ͷ
    cap = cv2.VideoCapture(0)

    # ����ʶ����ʱ�䣨�룩
    recognition_interval = 1  # ÿ��ʶ��һ��
    last_recognition_time = 0

    while True:
        # ��ȡ����ͷ֡
        ret, frame = cap.read()
        if not ret:
            print("�޷���ȡ����ͷ����")
            break

        current_time = time.time()

        # �Զ�ʶ�𣨰��̶�ʱ������
        if current_time - last_recognition_time > recognition_interval and gesture_control_enabled:
            # ��֡ת��Ϊbase64
            _, img_encoded = cv2.imencode('.jpg', frame)
            img_base64 = base64.b64encode(img_encoded).decode('utf-8')

            # ��������ʶ��API
            result = recognize_gesture(img_base64)
            print("ʶ����:", result)

            # ����ʶ����
            if result and 'result' in result:
                for item in result['result']:
                    classname = item['classname']
                    probability = item['probability']

                    # ֻ��������Ŷȵ�����
                    if probability > 0.6:
                        global last_gesture, last_gesture_time
                        last_gesture = classname
                        last_gesture_time = time.time()
                        print(f"��⵽����: {classname} (���Ŷ�: {probability:.2f})")

            last_recognition_time = current_time

        # ��ʾ����
        cv2.imshow('Gesture Recognition', frame)

        # ��'q'���˳�
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # �ͷ���Դ
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
    ʹ�� AK��SK ���ɼ�Ȩǩ����Access Token��
    :return: access_token������None(�������)
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
    print(f"���ƿ���״̬���л�: {'����' if gesture_control_enabled else '����'}")
    return jsonify({'enabled': gesture_control_enabled})

def run_flask_server():
    app.run(port=5000)  # ʹ��5000�˿ڣ�������apiService.py��8080��ͻ

if __name__ == '__main__':
    main()