const res = await fetch('http://localhost:5173/api/compile-mjml', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ mjmlString: '<mjml><mj-body><mj-section><mj-column><mj-text>Hello World</mj-text></mj-column></mj-section></mj-body></mjml>' })
});
console.log(res.status);
const text = await res.text();
console.log(text);
