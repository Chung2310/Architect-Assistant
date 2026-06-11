const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyC_6gfeYNu_D3Qdc6UfPT--GVMLa1c2WvA';

fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=' + apiKey, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { text: "Make the background blue." },
          { inlineData: { mimeType: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC" } }
        ]
      }
    ]
  })
})
.then(res => res.json())
.then(data => {
  console.log(data);
  if (data.candidates?.[0]?.content?.parts?.[0]) {
    console.log("Returned mimeType:", data.candidates[0].content.parts[0].inlineData?.mimeType);
  }
})
.catch(console.error);
