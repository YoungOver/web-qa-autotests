# web-qa-autotests

A Playwright audit that runs against any static build and produces a bug list a client can read.

![](docs/qa.jpg)

For every page it checks, on desktop and on a 390 px phone:

- JavaScript errors and failed network requests
- page weight and load time
- one H1, language attribute, meta description, alt text on images
- empty links and unlabeled form fields
- horizontal scroll and tap targets smaller than 32 px on mobile

The last run over [web-studio](https://github.com/YoungOver/web-studio) found 23 issues across 88 checks; `report.html` groups them by severity with the exact failing element.

```bash
npm i -D playwright-core
node run.mjs          # writes results.json
open report.html
```
