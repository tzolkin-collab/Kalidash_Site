const mjml = require('mjml-browser');
console.log("mjml-browser type:", typeof mjml);
console.log("mjml-browser keys:", Object.keys(mjml));
if (typeof mjml === 'function' || typeof mjml.default === 'function') {
  const func = typeof mjml === 'function' ? mjml : mjml.default;
  const result = func('<mjml><mj-body><mj-section><mj-column><mj-text>Hello</mj-text></mj-column></mj-section></mj-body></mjml>');
  console.log("Result type:", typeof result);
  console.log("Result keys:", Object.keys(result));
}
