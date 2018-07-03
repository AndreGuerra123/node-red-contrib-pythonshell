let fs = require('fs')
let assert = require('assert');
let spawn = require('child_process').spawn
let net = require("net");

let PythonShellRunner = require('./src/PythonShellRunner');
let pyexe;

describe('Pythonshell Node', function () {
	
	before(function (done) {

		this.timeout(10000);

		let spawn = require('child_process').spawn;
		
		try {
			ve = spawn('python', [__dirname + "/test_scripts/detectPython.py"]);
		} catch (e) {
			done(e);
		}

		ve.stdout.on('data', d => {
			pyexe = d.toString();
			console.log(d.toString());
		});
		ve.stderr.on('data', d => console.log(d.toString()));

		ve.on('close', done);
	
	});

	describe('Failing cases', function () {
		it('should throw an error for empty config', function (done) {
			try {
				let pyRun = new PythonShellRunner();
				done(1)
			} catch (e) {
				done()
			}
		});

		it('should throw an error for empty config', function (done) {
			try {
				let pyRun = new PythonShellRunner({});
				done(1)
			} catch (e) {
				done()
			}
		});

		it('should throw an error for config without python exe', function (done) {
			try {
				let pyRun = new PythonShellRunner({
					pyfile: __dirname + "/test_scripts/sample.py"
				});
				done(1)
			} catch (e) {
				done()
			}
		});

		it('should throw an error for config without python file', function (done) {
			try {
				let pyRun = new PythonShellRunner({
					pyexe: pyexe,
				});
				done(1)
			} catch (e) {
				done()
			}
		});

		it('should throw an error with wrong python exe', function (done) {
			try {
				let pyRun = new PythonShellRunner({
					pyexe: "/nevergonnahappen/python.exe",
					pyfile: __dirname + "/test_scripts/sample.py" 
				});
				done(1)
			} catch (e) {
				done()
			}
		});

		it('should throw an error with wrong python file', function (done) {
			try {
				let pyRun = new PythonShellRunner({
					pyexe: pyexe,
					pyfile: __dirname + "/test_scripts/sample.p" 
				});
				done(1)
			} catch (e) {
				done()
			}
		});

		it('should throw an error for non existing working dir', function (done) {
			try {
				let pyRun = new PythonShellRunner({
					pyexe: pyexe,
					pyfile: __dirname + "/test_scripts/sample.py",
					wdir: __dirname + "/awefaewaf"
				});
				done(1)
			} catch (e) {
				done()
			}
		});
	})

	describe('Run Python script', function () {
		it('should return the script result', function (done) {
			let pyRun = new PythonShellRunner({
				pyexe: pyexe,
				pyfile: __dirname + "/test_scripts/sample.py"
			});

			pyRun.onInput({
				payload: ""
			}, function (result) {
				assert.notEqual(result.payload, null);
				assert.equal(result.payload, 'hi');
				done()
			}, function (err) {
				done(err)
			});
		});

		it('should output script ongoing result', function (done) {
			this.timeout(10000);

			let runs = 0;

			let pyRun = new PythonShellRunner({
				pyexe: pyexe,
				pyfile: __dirname + "/test_scripts/sample-loop.py",
				continuous: true
			});

			pyRun.onInput({
				payload: ""
			}, function (result) {
				assert.notEqual(result.payload, null);
				assert.equal(result.payload.trim(), 'on going')
				runs++;

				if (runs >= 3) {
					done();
					pyRun.onClose();
				}
			}, function (err) {
				done(err)
			});
		});

		it('should not accepting input when is producing result', function (done) {
			this.timeout(10000);

			let ins = 0;
			let runner;

			let pyRun = new PythonShellRunner({
				pyexe: pyexe,
				pyfile: __dirname + "/test_scripts/sample-loop.py",
				continuous: true
			});

			pyRun.setStatusCallback(status => {
				if (ins === 2 && status.text === "Not accepting input") {
					clearInterval(runner)
					pyRun.onClose()
					done()
				}
			})

			runner = setInterval(() => {
				ins++
				pyRun.onInput({
					payload: "arg"
				}, (result) => {}, (err) => {
					done(err)
				})
			}, 500)

			// TODO: to double check, look at ps aux | grep python 
		});

		it('should pass arguments to script', function (done) {
			let pyRun = new PythonShellRunner({
				pyexe: pyexe,
				pyfile: __dirname + "/test_scripts/sample-with-arg.py"
			});

			pyRun.onInput({
				payload: "firstArg secondArg"
			}, function (result) {
				assert.notEqual(result.payload, null);
				assert.equal(result.payload, 'firstArg secondArg');
				done()
			}, function (err) {
				done(err)
			});
		});

		it('should support file read', function (done) {
			let pyRun = new PythonShellRunner({
				pyexe: pyexe,
				pyfile: __dirname + "/test_scripts/sample-file-read.py"
			});

			pyRun.onInput({
				payload: ""
			}, function (result) {
				assert.notEqual(result.payload, null);
				assert.equal(result.payload, fs.readFileSync(__dirname + '/test_scripts/test.txt', 'utf8'));
				done()
			}, function (err) {
				done(err)
			});
		});

		it('should support working directory', function (done) {
			let pyRun = new PythonShellRunner({
				pyexe: pyexe,
				pyfile: __dirname + "/test_scripts/sample-wdir.py",
				wdir: __dirname + "/test_scripts/wdir"
			});

			pyRun.onInput({
				payload: ""
			}, function (result) {
				assert.notEqual(result.payload, null);
				assert.equal(result.payload, 'inside directory');
				done()
			}, function (err) {
				done(err)
			});
		});
	});

	describe('piping using unix socket', () => {

		it.skip('pipe', function (done) {
			let client
			
			let py1File = __dirname + "/test_scripts/sample-loop.py"
			let py2File = __dirname + "/test_scripts/stdin-data.py"

			let py1 = spawn(pyexe, ['-u', py1File])
			let py2 = spawn(pyexe, ['-u', py2File])

			py2.stdout.pipe(process.stdout)

			py1.stdout.on('data', d => {
				if (client)
					client.write(d)
			})

			let pipeServer = net.createServer(stream => {
				stream.on('data', d => {
					py2.stdin.write(d)
				})
			})
			pipeServer.listen('./abc')

			client = net.connect('./abc', console.log)
		})

		it.skip('work stdin-data', function (done) {
			this.timeout(10000);

			let stdinDataFile = __dirname + "/test_scripts/stdin-data.py"

			let child = spawn(pyexe, ['-u', stdinDataFile])

			setInterval(() => {
				child.stdin.write("abc\n")
			}, 1000)

			child.stdout.pipe(process.stdout);
		});

		it('send data to python script stdin', function (done) {
			// TODO: here test just one input

			let pyRun = new PythonShellRunner({
				pyexe: pyexe,
				pyfile: __dirname + "/test_scripts/stdin-data.py",
				stdInData: true
			});

			pyRun.onInput({
				payload: "abc\n"
			}, function (result) {
				assert.equal(result.payload.trim(), "abc");
				done()
			}, function (err) {
				done(err)
			});

			setTimeout(() => {
				pyRun.onClose()
			}, 1000)
		});
	})
});