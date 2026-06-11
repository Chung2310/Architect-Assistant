const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyC_6gfeYNu_D3Qdc6UfPT--GVMLa1c2WvA';

fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview?key=' + apiKey)
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);

fetch('https://generativelanguage.googleapis.com/v1alpha/models/gemini-3.1-flash-image-preview?key=' + apiKey)
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
