#!/usr/bin/env python3
"""Offline browser release check (requires Python Playwright and the selected engine).

Executes the real UMD, standalone ESM, and static ESM sources. Relative static
imports are rewritten to equivalent Blob URLs. The README script-tag URL is
intercepted with exact candidate bytes; the public CDN and CSP are not tested.
"""
import argparse
import os
import json
import re
import shutil
import tempfile
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
parser.add_argument('--package', type=Path, help='Installed candidate package containing browser runtime files and documentation')
parser.add_argument('--output', type=Path)
parser.add_argument('--browser', choices=['chromium', 'firefox', 'webkit'], default='chromium')
parser.add_argument('--bundle', choices=['go-objects.js', 'go-objects.min.js'], default='go-objects.js')
parser.add_argument('--executable', help='Optional path to the selected browser executable')
args = parser.parse_args()
fixture_root = args.root.resolve()
root = (args.package or (args.root / 'package')).resolve()
output = args.output or Path(tempfile.mkdtemp(prefix='go-objects-browser-')) / 'results.json'
html = (fixture_root / 'test/browser/smoke.html').read_text(encoding='utf-8')
match = re.search(r'<script type="module">([\s\S]*?)</script>', html)
if not match:
    raise SystemExit('Missing browser smoke module.')
script = match.group(1).replace("import('../../package/dist/go-objects.mjs')", 'import(distUrl)').replace("import('../../package/index.mjs')", 'import(graphUrl)')
sources = {file.relative_to(root).as_posix(): file.read_text(encoding='utf-8')
           for file in (root / 'esm').rglob('*.mjs')
           if not any(part in ('temp', '.tmp') for part in file.relative_to(root).parts)}
sources['index.mjs'] = (root / 'index.mjs').read_text(encoding='utf-8')
# This regression module is test-owned, not part of the candidate payload.
sources['transport-fixture.mjs'] = (fixture_root / 'test/browser/module-fixture.mjs').read_text(encoding='utf-8')
imports = json.loads(subprocess.check_output(
    ['node', '-e', 'const sources=JSON.parse(require("node:fs").readFileSync(0,"utf8"));'
     'const {moduleSpecifiers}=require(' + json.dumps(str(Path(__file__).with_name('browser-module-specifiers.js'))) + ');'
     'process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(sources).map(([name,source])=>[name,moduleSpecifiers(source,name)]))));'],
    input=json.dumps(sources), text=True))

documented = json.loads(subprocess.check_output(
    ['node', '-e', 'process.stdout.write(JSON.stringify(require(' +
     json.dumps(str(Path(__file__).with_name('test-examples.js'))) +
     ').browserExamples(' + json.dumps(str(root)) + ')))'], text=True))
readme_document = json.loads(subprocess.check_output(
    ['node', '-e', 'process.stdout.write(JSON.stringify(require(' +
     json.dumps(str(Path(__file__).with_name('test-examples.js'))) +
     ').browserDocument(' + json.dumps(str(root)) + ',' + json.dumps(args.bundle) + ')))'], text=True))

documentation_count = len(documented)
documented.append({
    'name': 'Documentation transport preserves literal module paths', 'module': True, 'assertions': 0,
    'code': (fixture_root / 'test/browser/documentation-module-fixture.mjs').read_text(encoding='utf-8')})
example_imports = json.loads(subprocess.check_output(
    ['node', '-e', 'const examples=JSON.parse(require("node:fs").readFileSync(0,"utf8"));'
     'const {moduleSpecifiers}=require(' + json.dumps(str(Path(__file__).with_name('browser-module-specifiers.js'))) + ');'
     'process.stdout.write(JSON.stringify(examples.map(example=>example.module?moduleSpecifiers(example.code,example.name):[])));'],
    input=json.dumps(documented), text=True))
for example, specifiers in zip(documented, example_imports):
    example['imports'] = specifiers


with sync_playwright() as playwright:
    executable = args.executable
    if not executable and args.browser == 'chromium':
        executable = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE') or shutil.which('chromium')
    browser = getattr(playwright, args.browser).launch(
        executable_path=executable, headless=True,
        args=['--no-sandbox'] if args.browser == 'chromium' else [])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content('<!doctype html><pre id="results"></pre>')
    page.add_script_tag(content=(root / 'dist' / args.bundle).read_text(encoding='utf-8'))
    report = page.evaluate(r'''async ({sources,imports,dist,script}) => {
      const cache=new Map(), active=new Set();
      function moduleUrl(name) {
        if(cache.has(name)) return cache.get(name);
        if(active.has(name)) throw new Error('Unexpected dependency cycle: '+name);
        active.add(name);
        const source=sources[name]; if(source===undefined) throw new Error('Missing module '+name);
        let rewritten=source;
        for(const specifier of [...imports[name]].reverse()) {
          const dep=new URL(specifier.value,'https://offline.invalid/'+name).pathname.slice(1);
          rewritten=rewritten.slice(0,specifier.start)+JSON.stringify(moduleUrl(dep))+rewritten.slice(specifier.end);
        }
        const url=URL.createObjectURL(new Blob([rewritten],{type:'text/javascript'}));cache.set(name,url);active.delete(name);return url;
      }
      const distUrl=URL.createObjectURL(new Blob([dist],{type:'text/javascript'}));
      const graphUrl=moduleUrl('index.mjs');
      const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
      await new AsyncFunction('distUrl','graphUrl',script)(distUrl,graphUrl);
      const result=globalThis.__testResults;
      try {
        const fixture=await import(moduleUrl('transport-fixture.mjs'));
        fixture.checkTransport();
        result.results.push({name:'Blob transport preserves import-looking data',pass:true});
        result.passed++;
      } catch(error) {
        result.results.push({name:'Blob transport preserves import-looking data',pass:false,error:String(error.stack||error)});
        result.failed++;
      }
      for(const url of cache.values()) URL.revokeObjectURL(url);
      URL.revokeObjectURL(distUrl);
      return {...result,staticModules:[...cache.keys()].filter(name=>name!=='transport-fixture.mjs').length,
        transportModules:cache.has('transport-fixture.mjs')?1:0,float16Available:typeof Float16Array!=='undefined'};
    }''', {'sources': sources, 'imports': imports, 'dist': (root / 'dist/go-objects.mjs').read_text(encoding='utf-8'), 'script': script})

    documented_results = []
    for example in documented:
        try:
            page.evaluate(r'''async ({code, module, dist, imports}) => {
              if (!module) { new Function(code)(); return; }
              const distUrl = URL.createObjectURL(new Blob([dist], {type: 'text/javascript'}));
              let source = code;
              for (const specifier of [...imports].reverse()) {
                if (specifier.value !== './dist/go-objects.mjs') throw new Error('Unsupported documented browser import: ' + specifier.value);
                source = source.slice(0, specifier.start) + JSON.stringify(distUrl) + source.slice(specifier.end);
              }
              const url = URL.createObjectURL(new Blob([source], {type: 'text/javascript'}));
              try { await import(url); }
              finally { URL.revokeObjectURL(url); URL.revokeObjectURL(distUrl); }
            }''', {'code': example['code'], 'module': example['module'], 'imports': example['imports'],
                   'dist': (root / 'dist/go-objects.mjs').read_text(encoding='utf-8')})
            documented_results.append({'name': example['name'], 'pass': True, 'assertions': example['assertions']})
        except Exception as error:
            documented_results.append({'name': example['name'], 'pass': False, 'error': str(error)})
    report['results'].extend(documented_results)
    report['passed'] += sum(item['pass'] for item in documented_results)
    report['failed'] += sum(not item['pass'] for item in documented_results)
    report['documentationExamples'] = documentation_count
    report['transportRegressionChecks'] = 2

    # Load the unmodified documented script URL (or its documented minified alternative)
    # in a fresh page. Only the exact selected URL receives candidate bytes.
    delivery_page = browser.new_page()
    delivery_errors, delivery_requests, delivery_logs = [], [], []
    delivery_page.on('pageerror', lambda error: delivery_errors.append(str(error)))
    delivery_page.on('console', lambda message: delivery_logs.append([arg.json_value() for arg in message.args]) if message.type == 'log' else None)
    document_url = 'https://go-objects-example.invalid/'
    def deliver(route):
        url = route.request.url
        if url == document_url:
            route.fulfill(content_type='text/html', body='<!doctype html>' + readme_document['html'] + '<script>globalThis.__exampleCompleted = true;</script>')
        elif url == readme_document['scriptUrl']:
            delivery_requests.append(url)
            route.fulfill(content_type='application/javascript', body=(root / 'dist' / args.bundle).read_bytes())
        else:
            delivery_errors.append('Unexpected request: ' + url)
            route.abort()
    delivery_page.route('**/*', deliver)
    try:
        delivery_page.goto(document_url, wait_until='load')
        assert delivery_page.evaluate('globalThis.__exampleCompleted === true'), 'Incomplete README example'
        assert delivery_requests == [readme_document['scriptUrl']], 'README did not load the exact candidate URL'
        assert delivery_logs == [[True]], 'README displayed result differs: ' + repr(delivery_logs)
        delivery_page.evaluate((fixture_root / 'test/browser/bundle-contract.js').read_text(encoding='utf-8') + '\ncheckBrowserBundle(Objects);')
        assert not delivery_errors, repr(delivery_errors)
        report['results'].append({'name': 'README script-tag delivery', 'pass': True})
        report['passed'] += 1
    except Exception as error:
        report['results'].append({'name': 'README script-tag delivery', 'pass': False, 'error': str(error)})
        report['failed'] += 1
    finally:
        delivery_page.close()
    report['readmeScriptDelivery'] = {'url': readme_document['scriptUrl'], 'requests': delivery_requests,
        'transport': 'Exact-version URL interception with installed candidate bytes; no public CDN request.'}

    report.update({'packageRoot': str(root), 'browser': args.browser, 'bundle': args.bundle, 'browserVersion': browser.version, 'httpVerified': False,
                   'delivery': 'Offline actual bundles; static import specifiers rewritten to Blob URLs only.', 'pageErrors': errors})
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({**{key: value for key, value in report.items() if key != 'results'}, 'reportPath': str(output)}, indent=2))
    browser.close()
    if report['failed'] or errors:
        print(json.dumps([result for result in report['results'] if not result['pass']], indent=2))
        raise SystemExit(1)
