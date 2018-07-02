var pyRunner = require('../src/PythonShellRunner');

var pyfile = new File('../test/sample.py')
var pywdir = new File('../test/wdir/')

var pyRun = new pyRunner({
	pyexe: "/usr/bin/python",
	pyfile: pyfile.name,
	wdir: pywdir.name
});

var a = 1;

pyRun.onInput({payload: a}, console.log, console.log);