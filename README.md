# template
A minimal polyfill for `<template>`.

# Notice

This repository contains a fork maintained by Manuel Baclet of [webcomponents/template](https://github.com/webcomponents/template).

# Installation
`npm install template-mb`

# Browser support

## Table

|                |Chrome       |Firefox        |IE/Edge    |Opera         | Safari    |
|----------------|-------------|---------------|-----------|--------------|-----------|
|Flawless native |&ge;35       |&ge;22         |-          |&ge;22        |&ge;9      |
|Buggy native    |26-34 (i)    |-              |13-15 (c,i)|15-21  (i)    |6.2-8 (c,i)|
|Polyfill **     |-            |-              |11         |-             |-          |
|Polyfill *      |15-25        |-              |9-10       |11.6-12.16    |-          |

On line "Buggy native", c denotes problems when cloning templates or nodes that contain templates; i denoted problems when importing templates or nodes that contain templates. The polyfill fixes those problems.

On "Polyfill **" line, `<template>` will have correct prototype `HTMLTemplateElement` (unlike browsers on "Polyfill *" line).

## Polyfill caveats

### Subdocument templates

Templates included in subdocuments (such as HTMLImports) need to be bootstrapped before being usable by calling:
```js
if (window.HTMLTemplateElement.bootstrap) window.HTMLTemplateElement.bootstrap(otherDoc);
```

### Inherent limitation

Polyfilled templates are not as inert as native templates. For examples, scripts will be executed and images will be loaded.

In some rare situations, the HTML parser may break the template content. For example:

```html
<template id="table-fragment">
	<tr>
		<td>a</td><td>b</td>
	</tr>
</template>
```
will give you an empty template. To handle such situations, you can create the template element with JavaScript:
```js
var template = document.createElement('template');
template.innerHTML = '<tr><td>a</td><td>b</td></tr>';

```

## License

Everything in this repository is BSD style license unless otherwise specified.

Copyright (c) 2016 The Polymer Authors. All rights reserved.
