import subprocess,time,xml.etree.ElementTree as ET
for attempt in range(15):
 time.sleep(2)
 subprocess.run(['adb','shell','uiautomator','dump','/sdcard/amora.xml'],capture_output=True)
 r=subprocess.run(['adb','shell','cat','/sdcard/amora.xml'],capture_output=True,text=True)
 if 'Criar conta' in r.stdout and ('E-mail' in r.stdout or 'Senha' in r.stdout):
  with open('android-smoke.png','wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
  print('PASS: APK launched and account onboarding rendered in Android WebView')
  break
else:
 logs=subprocess.run(['adb','logcat','-d','-t','300'],capture_output=True,text=True).stdout
 print(logs)
 raise SystemExit('Android onboarding did not render')
