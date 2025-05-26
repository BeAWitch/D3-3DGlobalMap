from flask import Flask, request, jsonify
from flask_cors import CORS
import dashscope
from dashscope import Generation

app = Flask(__name__)
# 修改CORS配置，允许所有来源和所有方法
CORS(app, resources={
    r"/ask_ai/*": {
        "origins": "*",  # 允许所有来源
        "methods": ["GET", "POST", "OPTIONS"],  # 允许的方法
        "allow_headers": ["Content-Type"]  # 允许的头部
    }
})

dashscope.api_key = "sk-3f3730796bbb4f679a400f26ca9b6aef"

@app.route('/ask_ai/', methods=['POST', 'OPTIONS'])
def ask_ai():
    if request.method == 'OPTIONS':
        # 处理预检请求
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response

    try:
        print("start ai search...")
        data = request.json
        question = data.get('question', '')

        if not question.startswith("只回答国家名称"):
            question = f"只回答国家名称: {question}"

        response = Generation.call(
            model="qwen-turbo",
            messages=[{"role": "user", "content": question}],
            result_format="text"
        )

        if response.status_code == 200:
            answer = response.output["text"].split('\n')[0].strip()
            return jsonify({"answer": answer})
        else:
            return jsonify({"error": response.message}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=8080)