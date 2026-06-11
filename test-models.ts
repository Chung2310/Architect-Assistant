const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyC_6gfeYNu_D3Qdc6UfPT--GVMLa1c2WvA';

fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey)
  .then(res => res.json())
  .then(data => {
    const models = data.models?.filter(m => m.name.includes("image") || m.name.includes("generat") || m.name.includes("predict"));
    console.log(models.map(m => m.name + ": " + m.supportedGenerationMethods.join(', ')));
  })
  .catch(console.error);
