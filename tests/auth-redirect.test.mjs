import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('web/auth-redirect.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {authReturnUrl}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('each platform requests an exact Amora callback',()=>{assert.equal(authReturnUrl(false),'https://delta-1.github.io/-N-amora/docs/');assert.equal(authReturnUrl(true),'https://delta-1.github.io/-N-amora/docs/auth-callback.html');});
