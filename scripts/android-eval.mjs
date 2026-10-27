// Test-only CDP client. The installed debug APK exposes its local WebViews over adb.
const [page, expression] = process.argv.slice(2);
const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const target = page==='youtube'?targets.find(t=>t.type==='page'&&t.url.startsWith('https://com.amora.app')):targets.find(t => t.type === 'page' && t.url.includes('amora.local') &&
  (page === 'overlay' ? t.url.includes('overlay=1') : !t.url.includes('overlay=1')));
if (!target) throw Error(`No Amora ${page} WebView found`);
const value = await new Promise((resolve, reject) => {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const timer = setTimeout(() => { socket.close(); reject(Error('WebView evaluation timed out')); }, 15000);
  const finish = (err, value) => { clearTimeout(timer); socket.close(); err ? reject(err) : resolve(value); };
  socket.addEventListener('error', () => finish(Error('WebView connection failed')));
  socket.addEventListener('open', () => socket.send(JSON.stringify({id: 1, method: 'Runtime.evaluate',
    params: {expression, awaitPromise: true, returnByValue: true}})));
  socket.addEventListener('message', ({data}) => {
    const result = JSON.parse(data);
    if (result.id !== 1) return;
    if (result.error || result.result.exceptionDetails) finish(Error(JSON.stringify(result)));
    else finish(null, result.result.result.value);
  });
});

if(value!==undefined)console.log(typeof value==='string'?value:JSON.stringify(value));
