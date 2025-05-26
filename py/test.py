from flask import Flask, request, jsonify
from flask_cors import CORS
import dashscope
from dashscope import Generation

# 创建 Flask 应用实例
app = Flask(__name__)
CORS(app) # 允许跨域请求
# CORS(app, resources={r"/ask_ai/*": {"origins": "http://localhost:3000"}}) # 允许特定来源的跨域请求

dashscope.api_key = "sk-3f3730796bbb4f679a400f26ca9b6aef"  # 替换为你的真实API Key

@app.route('/ask_ai/', methods=['POST'])
def ask_ai():
    try:
        print("start ai search...")
        
        data = request.json
        question = data.get('question', '')

        # 确保问题格式正确
        if not question.startswith("只回答国家名称"):
            question = f"只回答国家名称: {question}"

        response = Generation.call(
            model="qwen-turbo",
            messages=[{"role": "user", "content": question}],
            result_format="text"
        )

        if response.status_code == 200:
            # 后处理确保只返回国家名
            answer = response.output["text"].split('\n')[0].strip()
            return jsonify({"answer": answer})
        else:
            return jsonify({"error": response.message}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=63342)