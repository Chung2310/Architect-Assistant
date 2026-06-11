const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyC_6gfeYNu_D3Qdc6UfPT--GVMLa1c2WvA';

fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=' + apiKey, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { text: "Generate an image of a blue sky." }
        ]
      }
    ]
  })
})
.then(res => res.json())
.then(data => {
  console.log(data);
  if (data.candidates?.[0]?.content?.parts?.[0]) {
    console.log("Returned part:", data.candidates[0].content.parts[0]);
  }
})
.catch(console.error);
