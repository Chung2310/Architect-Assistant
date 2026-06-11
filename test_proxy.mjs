import fetch from "node-fetch";

async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/gemini-proxy/v1alpha/models/gemini-2.5-flash:generateContent?key=dummy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
    });
    
    const text = await res.text();
    console.log(res.status, text);
  } catch(e) {
    console.error(e);
  }
}

test();
