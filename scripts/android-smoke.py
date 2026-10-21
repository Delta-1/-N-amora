"""Exercise the packaged app and its real Android overlay above the launcher."""
import re
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
        dump = shell('uiautomator', 'dump', '/sdcard/amora.xml')
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
    subprocess.run(['node', 'scripts/android-eval.mjs', page, expression], check=True)


def cancel_export():
    # The first Back can dismiss the filename keyboard before the picker itself.
    for _ in range(3):
        shell('input', 'keyevent', 'KEYCODE_BACK')
        time.sleep(1)
        dump = shell('uiautomator', 'dump', '/sdcard/amora.xml')
        if 'dumped' not in dump:
            continue
        xml = shell('cat', '/sdcard/amora.xml')
        if 'documentsui' not in xml:
            return
    raise AssertionError('Android document picker did not close')


try:
    wait_ui(lambda x: 'Criar conta' in x and ('E-mail' in x or 'Senha' in x),
            'APK renders account onboarding')
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
