// The shared project Site URL belongs to Workspaces. Always request Amora's own callback.
export const AMORA_WEB_RETURN='https://delta-1.github.io/-N-amora/docs/';
export const AMORA_ANDROID_RETURN=AMORA_WEB_RETURN+'auth-callback.html';
export const authReturnUrl=(android:boolean)=>android?AMORA_ANDROID_RETURN:AMORA_WEB_RETURN;
