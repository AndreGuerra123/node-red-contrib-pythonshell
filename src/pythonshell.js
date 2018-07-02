/**
 * Copyright 2014 Sense Tecnic Systems, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var util = require("util");
var fs = require("fs");
var httpclient;

module.exports = function(RED) {
  "use strict";

  function PythonShellRunner(config) {
    if (!config.pyfile){
      throw '\'.py\' script file not set. Please, refer absolute file path in node options.';
    }
    if(!config.pyexe){
      throw '\'python.exe\' not set. Please, refer absolute file path in node options.';
    }
    
    this.pyexe = config.pyexe;
    this.pyfile = config.pyfile;
    this.wdir = config.wdir;
    

    if (!fs.existsSync(this.pyexe)) {
      throw '\'python.exe\' does not exist. Please, refer absolute file path in node options.';
    }

    if(!fs.existsSync(this.pyfile)){
      throw '\'.py\' script file does not exist. Please, refer absolute file path in node options.'
    }
    
  
    if (this.wdir && !fs.existsSync(this.wdir)){
      throw 'The selected \'wdir\' does not exist. Please, refer absolute folder path to the desired working directory or remove this option.';
    }
  
    this.stdInData = config.stdInData;
    this.continuous = this.stdInData ? true : config.continuous;

    this.spawn = require('child_process').spawn;
    this.onStatus = ()=>{}
  }
  
  PythonShellRunner.prototype.onInput = function(msg, out, err) {
    msg = msg.payload || '';
    if (typeof msg === 'object'){
      msg = JSON.stringify(msg);
    } else if (typeof msg !== 'string'){
      msg = msg.toString();
    }
  
    if (msg === 'pythonshell@close'){
      if (this.py != null){
        this.onClose()
        return
      } else {
        // trigger new execution
        msg = ''
      }
    }
  
    if (this.continuous && !this.stdInData && this.py != null){
      this.onStatus({fill:"yellow",shape:"dot",text:"Not accepting input"})
      return
    }
    
    if (this.stdInData){
      if (!this.py){
        this.py = this.spawn(this.pyexe, ['-u',this.pyfile], {
          cwd: this.wdir ? this.wdir : undefined ,
          detached: true
        });
        this.firstExecution = true
      } else {
        this.firstExecution = false
      }
    } else {
      this.py = this.spawn(this.pyexe, ['-u',this.pyfile, msg], {
        cwd: this.wdir ? this.wdir : undefined
      });
    }
  
    this.onStatus({fill:"green",shape:"dot",text:"Standby"})
  
    // subsequence message, no need to setup callbacks
    if (this.stdInData && !this.firstExecution){
      this.py.stdin.write(msg + '\n')
      return
    }
  
    var py = this.py;
    var dataString = '';
    var errString = '';
  
    py.stdout.on('data', data => {
      clearTimeout(this.standbyTimer)
  
      this.onStatus({fill:"green",shape:"dot",text:"Processing data"})
  
      let dataStr = data.toString();
  
      dataString += dataStr;
  
      if (dataString.endsWith("\n")){
        if (this.continuous){
          out({payload: dataString});
          dataString = ''
        }
      }
  
      this.standbyTimer = setTimeout(()=>{
        this.onStatus({fill:"green",shape:"dot",text:"Standby"})
      }, 2000)
  
    });
  
    py.stderr.on('data', data => {
      errString += String(data);// just a different way to do it
      this.onStatus({fill:"red",shape:"dot",text:"Error: " + errString})
    });
  
    py.stderr.on('error', console.log)
    py.stdout.on('error', console.log)
    py.stdin.on('error', console.log)
    py.on('error', console.log)
  
    py.on('close', code =>{
      if (code){
        err('exit code: ' + code + ', ' + errString);
        this.onStatus({fill:"red",shape:"dot",text:"Exited: " + code})
      } else if (!this.continuous){
        out({payload: dataString.trim()});
        this.onStatus({fill:"green",shape:"dot",text:"Done"})
      } else {
        this.onStatus({fill:"yellow",shape:"dot",text:"Script Closed"})
      }
      this.py = null
      setTimeout(()=>{
        this.onStatus({})
      }, 2000)
    });
  
    if (this.stdInData){
      py.stdin.write(msg + '\n')
    }
  };
  
  PythonShellRunner.prototype.onClose = function() {
    if (this.py){
      this.py.kill()
      this.py = null
    }
  };
  
  PythonShellRunner.prototype.setStatusCallback = function(callback) {
    this.onStatus = callback
  };
  
  function PythonShell(n) {
    //Getting config for node and applying it
    RED.nodes.createNode(this,n);
    var node = this;
    node.config = n; // copy config to the backend so that down bellow we can have a reference

    var pyNode = new PythonShellRunner(n); // Running with the configuration

    pyNode.setStatusCallback(node.status.bind(node))
  
    node.on("input",function(msg) {
      pyNode.onInput(msg, function(result){
        node.send(result);
      }, function(err){
        node.error(err);
      });
    });

    node.on('close', ()=>pyNode.onClose());
  }

  RED.nodes.registerType("pythonshell", PythonShell);

  RED.httpAdmin.post("/pythonshell/:id", RED.auth.needsPermission("pythonshell.query"), function(req,res) {
    var node = RED.nodes.getNode(req.params.id);
    if (node != null) {
      try {
        if (node.config.continuous){// see above comment
          node.receive({payload: 'pythonshell@close'})
        } else {
          node.receive();
        }
        res.sendStatus(200);
      } catch(err) {
          res.sendStatus(500);
          node.error(RED._("pythonshell.failed",{error:err.toString()}));
      }
    } else {
        res.sendStatus(404);
    }
  });

}
