"""Exercise the packaged app and its real Android overlay above the launcher."""
import re
import os
import xml.etree.ElementTree as ET
import subprocess
import time
from pathlib import Path


def shell(*args):
    return subprocess.run(['adb', 'shell', *args], capture_output=True,
                          text=True, check=True).stdout


def screenshot(name):
    with open(f'android-smoke-{name}.png', 'wb') as output:
        subprocess.run(['adb', 'exec-out', 'screencap', '-p'], stdout=output, check=True)


def wait_ui(predicate, label):
    for _ in range(15):
        time.sleep(2)
        try:
            dump = shell('uiautomator', 'dump', '/sdcard/amora.xml')
        except subprocess.CalledProcessError:
            continue  # UiAutomation can be killed while the emulator finishes booting.
        if 'UI hierchary dumped' not in dump and 'UI hierarchy dumped' not in dump:
            continue  # Android may still be relaunching the WebView window.
        result = subprocess.run(['adb', 'shell', 'cat', '/sdcard/amora.xml'],
                                capture_output=True, text=True).stdout
        Path('android-smoke-ui.xml').write_text(result)
        if predicate(result):
            print('PASS:', label, flush=True)
            return result
    raise AssertionError(label)


def wait_bubble():
    # A non-focusable overlay is not part of uiautomator's active-window tree.
    # Check its actual visible WindowManager surface, then tap its real bounds.
    for _ in range(20):
        windows = shell('dumpsys', 'window', 'windows')
        for block in re.split(r'(?=  Window #)', windows):
            if 'Amora Lilith Bubble' not in block:
                continue
            if 'mHasSurface=true' in block and ('isOnScreen=true' in block or 'isVisible=true' in block):
                bounds = re.search(r'(?:mFrame|frame)=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]', block)
                if bounds:
                    print('PASS: native Lilith bubble has a visible overlay surface', flush=True)
                    return tuple(map(int, bounds.groups()))
        time.sleep(1)
    raise AssertionError('Lilith bubble has no visible Android overlay surface')


def click_ui(xml, predicate):
    node = next(n for n in ET.fromstring(xml).iter('node') if predicate(n))
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds')))
    shell('input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))


def evaluate(page, expression):
    pid = shell('pidof', 'com.amora.app').strip().split()[0]
    subprocess.run(['adb', 'forward', 'tcp:9223', f'localabstract:webview_devtools_remote_{pid}'], check=True)
    result=subprocess.run(['node', 'scripts/android-eval.mjs', page, expression],capture_output=True,text=True)
    if result.returncode: raise AssertionError(result.stderr)
    if result.stdout.strip(): print(result.stdout.strip(),flush=True)
    return result.stdout.strip()


def cancel_export():
    # The first Back can dismiss the filename keyboard before the picker itself.
    for _ in range(3):
        shell('input', 'keyevent', 'KEYCODE_BACK')
        time.sleep(1)
        try:
            dump = shell('uiautomator', 'dump', '/sdcard/amora.xml')
        except subprocess.CalledProcessError:
            continue  # UiAutomation can be killed while the emulator finishes booting.
        if 'dumped' not in dump:
            continue
        xml = shell('cat', '/sdcard/amora.xml')
        if 'documentsui' not in xml:
            return
    raise AssertionError('Android document picker did not close')


try:
    xml=wait_ui(lambda x: 'Criar conta' in x and ('E-mail' in x or 'Senha' in x),
            'APK renders account onboarding')
    evaluate('main', "document.querySelector('.password-toggle').scrollIntoView({block:'center'})")
    xml=wait_ui(lambda x:'Mostrar senha' in x,'show-password control is reachable')
    click_ui(xml,lambda n:n.get('content-desc','')=='Mostrar senha' or n.get('text','')=='Mostrar senha')
    xml=wait_ui(lambda x:'Ocultar senha' in x,'password becomes visible after tapping show')
    evaluate('main', "(()=>{if(document.querySelector('input[name=password]').type!=='text')throw Error('Password remains hidden');return 'Visible password verified';})()")
    click_ui(xml,lambda n:n.get('content-desc','')=='Ocultar senha' or n.get('text','') in ('Ocultar','Ocultar senha'))
    wait_ui(lambda x:'Mostrar senha' in x,'password can be hidden again')
    evaluate('main', "(()=>{if(document.querySelector('input[name=password]').type!=='password')throw Error('Password remains visible');return 'Password visibility toggle works';})()")
    subprocess.run(['adb', 'logcat', '-c'], check=True)
    # Consent is granted only on the clean test emulator.
    shell('appops', 'set', 'com.amora.app', 'SYSTEM_ALERT_WINDOW', 'allow')
    print(shell('am', 'start', '-W', '-n', 'com.amora.app/.MainActivity', '-a', 'amora.overlay'), flush=True)
    wait_bubble()  # Let foreground service start before leaving the activity.
    shell('input', 'keyevent', 'KEYCODE_HOME')
    x1, y1, x2, y2 = wait_bubble()
    screenshot('bubble')
    shell('input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))
    wait_ui(lambda x: 'abrir amora' in x.casefold() and 'recolher' in x.casefold(),
            'bubble opens the floating Lilith panel above the launcher')
    screenshot('panel')
    xml = wait_ui(lambda x: 'recolher' in x.casefold(), 'floating panel is interactive')
    click_ui(xml, lambda n: n.get('text', '').casefold() == 'recolher')
    wait_ui(lambda x: 'recolher' not in x.casefold(), 'minimizing releases the panel window')
    x1, y1, x2, y2 = wait_bubble()
    shell('input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))
    wait_ui(lambda x: 'recolher' in x.casefold(), 'floating panel reopens after minimizing')

    # Drive the same bridge used by CSV/SVG export, then interact with Android's picker.
    shell('rm', '-f', '/sdcard/Download/amora-smoke.csv')
    evaluate('overlay', "window.AmoraAndroid.saveFile('amora-smoke.csv','text/csv','descrição;valor\\nTeste;12,34\\n')")
    xml = wait_ui(lambda x: 'amora-smoke.csv' in x and 'recolher' not in x.casefold(),
                  'document picker replaces overlay without being covered')
    screenshot('save-picker')
    click_ui(xml, lambda n: n.get('text', '').upper() in ('SAVE', 'SALVAR') and n.get('enabled') == 'true')
    wait_ui(lambda x: 'recolher' in x.casefold(), 'saving returns to the floating panel')
    assert shell('cat', '/sdcard/Download/amora-smoke.csv') == 'descrição;valor\nTeste;12,34\n'
    print('PASS: exported CSV is saved with exact UTF-8 contents', flush=True)

    evaluate('overlay', "window.AmoraAndroid.saveFile('amora-cancel.svg','image/svg+xml','<svg xmlns=\"http://www.w3.org/2000/svg\"/>')")
    wait_ui(lambda x: 'amora-cancel.svg' in x, 'SVG export opens Android document picker')
    cancel_export()
    wait_ui(lambda x: 'recolher' in x.casefold(), 'canceling export returns to the floating panel')
    evaluate('overlay', "window.AmoraAndroid.saveFile('amora-retry.csv','text/csv','ok')")
    wait_ui(lambda x: 'amora-retry.csv' in x, 'export works again after cancellation')
    cancel_export()
    wait_ui(lambda x: 'recolher' in x.casefold(), 'retry cancellation keeps panel usable')
    screenshot('export-complete')
    xml = wait_ui(lambda x: 'recolher' in x.casefold(), 'panel remains usable after exports')
    click_ui(xml, lambda n: n.get('text', '').casefold() == 'abrir amora')
    wait_ui(lambda x: 'Criar conta' in x and 'recolher' not in x.casefold(), 'toolbar returns to the main app')
    evaluate('main', "window.AmoraAndroid.saveFile('amora-main.csv','text/csv','ok')")
    wait_ui(lambda x: 'amora-main.csv' in x, 'export also opens from the main app')
    cancel_export()
    wait_ui(lambda x: 'Criar conta' in x and 'recolher' not in x.casefold(),
            'main-app export does not force the user into the floating panel')
    screenshot('main-export-complete')
    # Exercise the actual app drawer and map without requiring account credentials.
    evaluate('main', "document.querySelector('.explore-button').click()")
    wait_ui(lambda x: 'Comunidade' in x and 'Apps' in x, 'demo enters the complete mobile shell')
    evaluate('main', "(()=>{const c=document.querySelector('.corner-menu');if(getComputedStyle(c).display==='none')throw Error('Rotating menu missing');const buttons=Array.from(c.querySelectorAll('[data-visible=true]'));if(buttons.length!==3||buttons.some(x=>{const r=x.getBoundingClientRect();return r.width<40||r.left<0||r.right>innerWidth||r.bottom>innerHeight;}))throw Error('Rotating shortcuts clipped');return 'Three rotating shortcuts fit the phone';})()")
    xml=wait_ui(lambda x:'Menu giratório' in x and 'Comunidade' in x,'rotating menu ready for a finger gesture')
    import json
    # UIAutomator can mark the page heading clickable through the parent's touch handler.
    # Use the actual DOM shortcuts and map CSS coordinates into the native WebView bounds.
    points=json.loads(evaluate('main', "(()=>{const center=id=>{const r=document.querySelector('.corner-menu [data-app='+id+']').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]};window.__rotaryHeading=document.querySelector('.main-content h1')?.textContent;window.__rotaryTrace=[];for(const t of ['pointerdown','pointerup','pointercancel'])document.addEventListener(t,e=>window.__rotaryTrace.push({t,p:e.pointerType,b:e.button,app:e.target.closest('[data-app]')?.dataset.app,x:e.clientX,y:e.clientY}),true);return JSON.stringify({start:center('community'),end:center('map'),width:innerWidth,height:innerHeight})})()"))
    view=next(n for n in ET.fromstring(xml).iter('node') if n.get('class')=='android.webkit.WebView')
    vx1,vy1,vx2,vy2=map(int,re.findall(r'-?\d+',view.get('bounds')))
    def screen_point(p):return round(vx1+p[0]*(vx2-vx1)/points['width']),round(vy1+p[1]*(vy2-vy1)/points['height'])
    sx,sy=screen_point(points['start']);ex,ey=screen_point(points['end'])
    print('Rotary finger coordinates:',sx,sy,ex,ey,flush=True)
    shell('input','swipe',str(sx),str(sy),str(ex),str(ey),'650')
    wait_ui(lambda x:'Apps' in x and 'Nosso perfil' in x,'finger swipe settles on another group')
    evaluate('main', "(()=>{const c=document.querySelector('.corner-menu');if(c.dataset.index==='0'||c.dataset.phase!=='idle')throw Error('Swipe did not rotate '+JSON.stringify({index:c.dataset.index,phase:c.dataset.phase,trace:window.__rotaryTrace}));if(document.querySelector('.main-content h1')?.textContent!==window.__rotaryHeading)throw Error('Drag changed the current screen');return 'Finger swipe rotates without accidental navigation';})()")
    screenshot('rotating-menu')
    evaluate('main', "document.querySelector('.corner-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}))")
    screenshot('community')
    evaluate('main', "document.querySelector('.corner-apps').click()")
    xml = wait_ui(lambda x: 'Aplicativos' in x and 'Mapa' in x, 'Apps drawer opens all routes')
    evaluate('main', "(()=>{const map=Array.from(document.querySelectorAll('.app-tile')).find(x=>x.textContent==='Mapa').getBoundingClientRect();if(map.height<30||map.top<0||map.bottom>innerHeight)throw Error('Map shortcut is clipped by the drawer');return 'Map shortcut fits the visible drawer';})()")
    import json
    # Real finger gestures, including a short drag that must return to its original position.
    handle=next(n for n in ET.fromstring(xml).iter('node') if 'Arraste para baixo' in n.get('content-desc','') or 'Arraste para baixo' in n.get('text',''))
    x1,y1,x2,y2=map(int,re.findall(r'-?\d+',handle.get('bounds')))
    x,y=(x1+x2)//2,(y1+y2)//2
    shell('input','swipe',str(x),str(y),str(x),str(y+35),'550')
    wait_ui(lambda x: 'Aplicativos' in x and 'Mapa' in x, 'short drawer drag returns to its open position')
    shell('input','swipe',str(x),str(y),str(x),str(y+310),'450')
    wait_ui(lambda x: 'Aplicativos' not in x and 'Comunidade' in x, 'long drawer drag dismisses to the previous screen')
    evaluate('main', "document.querySelector('.corner-apps').click()")
    xml=wait_ui(lambda x: 'Aplicativos' in x and 'Mapa' in x, 'drawer reopens after a drag dismissal')
    click_ui(xml, lambda n: n.get('text', '') == 'Mapa')
    wait_ui(lambda x: 'Mapa com a posição' in x and 'Quem está por perto' in x, 'map opens before any GPS position is available')
    evaluate('main', "(()=>{const map=document.querySelector('.leaflet-couple-map'),r=map.getBoundingClientRect();if(!map.classList.contains('leaflet-container')||r.height<innerHeight-2||r.width<innerWidth-2)throw Error('Map is not full screen');if(document.querySelectorAll('.map-person-name').length!==2)throw Error('Profiles are missing from map');if(getComputedStyle(document.querySelector('.corner-menu')).display!=='none')throw Error('Main dock covers map');return 'Full screen map with two labeled demo markers';})()")
    screenshot('map')
    evaluate('main', "document.querySelectorAll('.map-people button')[1].click()")
    wait_ui(lambda x: 'Posição atualizada' in x and 'Seu amor' in x, 'profile balloon and person panel identify the selected partner')
    evaluate('main', "Array.from(document.querySelectorAll('.map-tool-tabs button')).find(x=>x.textContent==='Lugares').click()")
    wait_ui(lambda x: 'Nossos lugares' in x and 'Marcar no mapa' in x, 'places open in the bottom tools panel')
    evaluate('main', "Array.from(document.querySelectorAll('.map-tool-tabs button')).find(x=>x.textContent==='Passos').click()")
    wait_ui(lambda x: 'Passos do mês' in x and 'Sem registros' in x, 'step summary opens from map shortcut')
    evaluate('main', "Array.from(document.querySelectorAll('.map-tool-tabs button')).find(x=>x.textContent==='GPS').click()")
    xml=wait_ui(lambda x: 'Nosso GPS' in x and 'Recolher informações do mapa' in x, 'GPS controls open without leaving the map')
    node=next(n for n in ET.fromstring(xml).iter('node') if 'Recolher informações do mapa' in (n.get('content-desc','')+' '+n.get('text','')))
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds')))
    shell('input','swipe',str((x1+x2)//2),str((y1+y2)//2),str((x1+x2)//2),str((y1+y2)//2+130),'500')
    wait_ui(lambda x: 'Expandir informações do mapa' in x, 'map sheet follows a downward drag and collapses')
    evaluate('main', "document.querySelector('[aria-label=\"Entrar com código no vínculo\"]').click()")
    wait_ui(lambda x: 'Um código, um novo encontro' in x, 'join code shortcut requires sign-in before linking')
    shell('input','keyevent','KEYCODE_BACK')
    wait_ui(lambda x: 'Voltar do mapa' in x, 'closing invitation returns to the map')
    evaluate('main', "document.querySelector('[aria-label=\"Voltar do mapa\"]').click()")
    wait_ui(lambda x: 'A vida fica mais bonita' in x and 'Apps' in x, 'map back returns to the home screen')
    evaluate('main', "window.dispatchEvent(new CustomEvent('amora-native',{detail:{route:'camera'}}))")
    wait_ui(lambda x: 'Personalizar foto' in x and 'Tirar foto' in x, 'camera opens directly from bottom navigation')
    evaluate('main', "(()=>{const b=document.querySelector('.camera-controls').getBoundingClientRect();if(b.bottom>innerHeight-60||b.top<0)throw Error('Camera controls require scrolling');return 'Camera controls fit the viewport';})()")
    screenshot('camera')
    evaluate('main', "document.querySelector('[aria-label=\"Personalizar foto\"]').click()")
    wait_ui(lambda x: 'Marca na foto' in x and 'Salvar também no celular' in x, 'camera customization opens without scrolling the camera')
    evaluate('main', "document.querySelector('[aria-label=\"Fechar personalização\"]').click()")
    evaluate('main', "(()=>{const c=document.createElement('canvas');c.width=100;c.height=100;const x=c.getContext('2d');x.fillStyle='#c3a2ff';x.fillRect(0,0,100,100);window.AmoraAndroid.savePhoto('namora-smoke-photo.jpg',c.toDataURL('image/jpeg').split(',')[1],'Foto de teste do Amora');})()")
    wait_ui(lambda x: 'Foto salva na galeria' in x, 'native camera output saves automatically to MediaStore gallery')
    photos=shell('content','query','--uri','content://media/external/images/media','--projection','_display_name:relative_path')
    assert 'namora-smoke-photo.jpg' in photos and 'Pictures/NAMORA' in photos
    print('PASS: captured JPEG exists in gallery Pictures/NAMORA',flush=True)
    for label, title in [('Conversa','Seu amor, logo aqui.'),('Nosso bolso','Dividir também é cuidar.'),('Jogos','Um tempinho para brincar.'),('Desenho','Memórias em cada traço.'),('Notas','O que a gente imagina junto.'),('Agenda','Tempo para o que importa.'),('Nossa história','Os dias que viraram nós.'),('Combinados','Pequenos planos, juntos.'),('Ideias','Boas ideias, lindas memórias.'),('Arquivos','Nossos arquivos'),('Álbum','Nossas lembranças')]:
        evaluate('main', "document.querySelector('.corner-apps').click()")
        wait_ui(lambda x: 'Aplicativos' in x and 'Organizar' in x, 'drawer is ready for '+label)
        import json
        evaluate('main', "Array.from(document.querySelectorAll('.app-tile')).find(x=>x.textContent==="+json.dumps(label)+").click()")
        wait_ui(lambda x: title in x, 'menu opens '+label)

    evaluate('main', "window.dispatchEvent(new CustomEvent('amora-native',{detail:{route:'chat'}}))")
    wait_ui(lambda x: 'Voltar das mensagens' in x and 'Só vocês dois' in x, 'partner chat opens as its own screen')
    evaluate('main', "(()=>{if(getComputedStyle(document.querySelector('.corner-menu')).display!=='none')throw Error('Navigation covers conversation');const c=document.querySelector('.composer').getBoundingClientRect();if(c.bottom>innerHeight||c.top<0)throw Error('Composer is outside the viewport');return 'Conversation composer visible';})()")
    screenshot('conversation')
    evaluate('main', "window.dispatchEvent(new CustomEvent('amora-native',{detail:{route:'camera'}}))")
    wait_ui(lambda x:'Personalizar foto' in x and 'Tirar foto' in x,'floating shortcut can open camera from the full conversation')
    evaluate('main', "window.dispatchEvent(new CustomEvent('amora-native',{detail:{route:'home'}}))")
    wait_ui(lambda x:'A vida fica mais bonita' in x and 'Apps' in x,'floating shortcut restores home navigation after conversation')
    evaluate('main', "window.dispatchEvent(new CustomEvent('amora-native',{detail:{route:'chat'}}))")
    wait_ui(lambda x:'Voltar das mensagens' in x and 'Só vocês dois' in x,'conversation can reopen after another shortcut')
    shell('input','keyevent','KEYCODE_BACK')
    wait_ui(lambda x: 'A vida fica mais bonita'  in x and 'Apps' in x, 'Android back returns from conversation to home')
    x1,y1,x2,y2=wait_bubble()
    h=int(shell('wm','size').strip().split()[-1].split('x')[-1]);w=int(shell('wm','size').strip().split()[-1].split('x')[0])
    shell('input','swipe',str((x1+x2)//2),str((y1+y2)//2),str(w//2),str(h-70),'1000')
    time.sleep(2)
    services=shell('dumpsys','activity','services','com.amora.app')
    assert 'OverlayService' not in services
    print('PASS: dropping bubble on X disables its service',flush=True)

    if os.environ.get('GITHUB_REF') == 'refs/heads/main':
        shell('run-as','com.amora.app','mkdir','-p','files/amora-web-v1/active')
        subprocess.run(['adb','shell','run-as','com.amora.app','tee','files/amora-web-v1/active/web-update.json'],input='{"id":"previous-test-version"}',text=True,capture_output=True,check=True)
        evaluate('main', "window.AmoraAndroid.checkWebUpdate()")
        xml=wait_ui(lambda x:'Atualizar agora' in x,'new web bundle is offered inside the installed Android app')
        click_ui(xml,lambda n:n.get('text','')=='Atualizar agora')
        wait_ui(lambda x:'Baixando' not in x and ('Comunidade' in x or 'Criar conta' in x),'web update returns to the application without reinstalling APK')
        evaluate('main', "(()=>{const d=JSON.parse(window.AmoraAndroid.webVersion());if(!/^[a-f0-9]{64}$/.test(d.id))throw Error('Downloaded bundle was not activated');return 'Verified downloaded web bundle active without APK reinstall';})()")
        screenshot('updated')


finally:
    screenshot('final')
    for name, args in {
        'windows': ('dumpsys', 'window', 'windows'),
        'services': ('dumpsys', 'activity', 'services', 'com.amora.app'),
    }.items():
        result = shell(*args)
        Path(f'android-smoke-{name}.txt').write_text(result)
        if name == 'services':
            print(result, flush=True)
    logs = subprocess.run(['adb', 'logcat', '-d'], capture_output=True, text=True).stdout
    Path('android-smoke-logcat.txt').write_text(logs)
    print('\n'.join(line for line in logs.splitlines()
                    if any(x in line for x in ('com.amora', 'FATAL EXCEPTION', 'AndroidRuntime: Process:', 'SecurityException'))), flush=True)
