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
var pyRunner = require('.\PythonShellRunner');
var httpclient;

module.exports = function(RED) {
  "use strict";

  
  function PythonShell(n) {
    //Getting config for node and applying it
    RED.nodes.createNode(this,n);
    var node = this;
    node.config = n; // copy config to the backend so that down bellow we can have a reference

    var pyRun = new pyRunner(n); // Running with the configuration

    pyRun.setStatusCallback(node.status.bind(node))
  
    node.on("input",function(msg) {
      pyRun.onInput(msg, function(result){
        node.send(result);
      }, function(err){
        node.error(err);
      });
    });

    node.on('close', ()=>pyRun.onClose());
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
