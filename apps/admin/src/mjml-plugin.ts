import type { Plugin } from 'vite';
import mjml2html from 'mjml';

export function mjmlPlugin(): Plugin {
  return {
    name: 'mjml-compiler',
    configureServer(server) {
      server.middlewares.use('/api/compile-mjml', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', async () => {
            try {
              const { mjmlString } = JSON.parse(body);
              let result = mjml2html(mjmlString, { validationLevel: 'soft' });
              if (result instanceof Promise) {
                result = await result;
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ html: result.html }));
            } catch (err) {
              console.error('MJML compile error:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message || String(err) }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });
    }
  };
}
