import subprocess,time,json
def shell(*args):
 return subprocess.run(['adb','shell',*args],capture_output=True,text=True,check=True).stdout
def evaluate(expression):
 pid=shell('pidof','com.amora.app').strip().split()[0]
 subprocess.run(['adb','forward','tcp:9223','localabstract:webview_devtools_remote_'+pid],check=True)
 r=subprocess.run(['node','scripts/android-eval.mjs','main',expression],capture_output=True,text=True)
 if r.returncode: print('EVALUATE_ERROR',r.stderr,flush=True);return ''
 print(r.stdout.strip(),flush=True);return r.stdout.strip()
for _ in range(30):
 time.sleep(1)
 if evaluate("JSON.stringify({ready:document.readyState,href:location.href,base:document.baseURI,hidden:document.hidden,ua:navigator.userAgent,secure:isSecureContext,withResolvers:typeof Promise.withResolvers})"):break
evaluate("window.__pdfProbe={stage:'fetch',events:[]};window.addEventListener('unhandledrejection',e=>__pdfProbe.events.push(String(e.reason)));void(async()=>{for(const file of ['pdf.min.js','pdf.worker.min.js']){const r=await fetch(new URL('./pdfjs/'+file,location.href));const text=await r.text();__pdfProbe.events.push({file,status:r.status,mime:r.headers.get('content-type'),size:text.length});}__pdfProbe.stage='importMain';window.__pdfModule=await import(new URL('./pdfjs/pdf.min.js',location.href).href);__pdfProbe.events.push('main loaded');__pdfProbe.stage='importWorker';globalThis.pdfjsWorker=await import(new URL('./pdfjs/pdf.worker.min.js',location.href).href);__pdfProbe.events.push('worker loaded');__pdfModule.GlobalWorkerOptions.workerSrc=new URL('./pdfjs/pdf.worker.min.js',location.href).href;__pdfProbe.stage='doc';const source='%PDF-1.4\\n1 0 obj\\n<< /Type /Catalog /Pages 2 0 R >>\\nendobj\\n2 0 obj\\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\\nendobj\\n3 0 obj\\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Contents 4 0 R >>\\nendobj\\n4 0 obj\\n<< /Length 28 >>\\nstream\\n0 0 1 rg 20 20 200 300 re f\\nendstream\\nendobj\\ntrailer\\n<< /Root 1 0 R >>\\n%%EOF';window.__pdfDoc=await __pdfModule.getDocument({data:new TextEncoder().encode(source),isEvalSupported:false}).promise;__pdfProbe.events.push({pages:__pdfDoc.numPages});__pdfProbe.stage='page';const p=await __pdfDoc.getPage(1),v=p.getViewport({scale:1}),c=document.createElement('canvas');c.width=v.width;c.height=v.height;document.body.append(c);__pdfProbe.stage='render';await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;__pdfProbe.events.push({pixel:Array.from(c.getContext('2d').getImageData(100,100,1,1).data)});__pdfProbe.stage='destroy';await __pdfDoc.destroy();__pdfProbe.stage='done';})().catch(e=>{__pdfProbe.stage='error';__pdfProbe.error=String(e);__pdfProbe.stack=e.stack;});'Probe started'")
for _ in range(30):
 time.sleep(1)
 result=evaluate('JSON.stringify(window.__pdfProbe)')
 if '"stage":"done"' in result:break
 if '"stage":"error"' in result:raise AssertionError(result)
else:raise AssertionError('Probe stalled; see last reported stage')
