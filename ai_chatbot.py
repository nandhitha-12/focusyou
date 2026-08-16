import os

from groq import Groq
 
# ✅ Paste your Groq API key here (from console.groq.com)
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
 
client = Groq(api_key=GROQ_API_KEY)
 
def ask_groq(message):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",  # ✅ updated model
        messages=[
            {"role": "system", "content": "You are a helpful focus and study assistant."},
            {"role": "user", "content": message}
        ]
    )
    return response.choices[0].message.content
 
# Test it
print(ask_groq("Hello"))
 