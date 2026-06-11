const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyC_6gfeYNu_D3Qdc6UfPT--GVMLa1c2WvA';

fetch('https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001?key=' + apiKey)
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);

fetch('https://generativelanguage.googleapis.com/v1alpha/models/imagen-4.0-generate-001?key=' + apiKey)
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
