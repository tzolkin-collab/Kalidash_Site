import mjmlBrowser from 'mjml-browser/lib/index.js';

export default function mjmlProxy(mjmlString, options) {
  try {
    const result = mjmlBrowser(mjmlString, options);
    if (result.errors && result.errors.length > 0) {
      console.error("MJML ERRORS:", result.errors);
      // Return the HTML anyway if it exists, otherwise return a formatted error
      if (result.html) return result;
      return { html: `<div><b>MJML Compile Errors:</b><br/>${result.errors.map(e => e.message).join('<br/>')}</div>` };
    }
    return result;
  } catch (e) {
    console.error("MJML EXCEPTION:", e);
    return { html: `<div><b>MJML Exception:</b><br/>${e.message}</div>` };
  }
}
