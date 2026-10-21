"""Exercise the packaged app and its real Android overlay above the launcher."""
import re
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
    wait_ui(lambda x: 'Abrir Amora' in x and 'Recolher' in x,
            'bubble opens the floating Lilith panel above the launcher')
    screenshot('panel')
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
