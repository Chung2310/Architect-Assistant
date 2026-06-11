const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyC_6gfeYNu_D3Qdc6UfPT--GVMLa1c2WvA';

fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=' + apiKey, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { text: "Make the sky blue." },
          { inlineData: { mimeType: "image/jpeg", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" } }
        ]
      }
    ],
    generationConfig: {
       // Is editConfig recognized?
       editConfig: {
         editMode: "VISUAL_INSTRUCT_PIX2PIX",
         preservationLevel: "HIGH"
       }
    }
  })
})
.then(res => res.json())
.then(console.log)
.catch(console.error);
