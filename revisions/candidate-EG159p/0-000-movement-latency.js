(function(){
'use strict';
const baseCommit=Gulch.commit;
let latest=null,pending=null,output=null;
const preparation=[],waits=[];
function push(list,value){list.push(value);if(list.length>40)list.shift();}
function median(list){if(!list.length)return null;const sorted=list.slice().sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];}
function format(value){return value===null?'no samples':value.toFixed(2)+' ms';}
const epoch=s=>String(s?.gameState?.respawnSettings?.token||'original');
function render(){
 if(!output)return;
 output.textContent='Movement commit preparation: '+format(median(preparation))+'. Observed pending-gate duration: '+format(median(waits))+'. Completed samples: '+waits.length+'. '+(pending?'Current wait: '+format(performance.now()-pending.started)+'. ':'')+'These local durations include processing, host messaging and recovery. They are not network RTT and do not establish that this browser’s proposal was accepted. Network ping: unavailable.';
}
function finish(){
 if(!pending||window.GulchMovementState?.inFlight)return;
 const record=pending;pending=null;
 if(latest?.revision===record.source&&epoch(latest)===record.epoch&&!document.hidden)push(waits,performance.now()-record.started);
 render();
}
Gulch.register('movement-latency',{snapshot(s){
 if(pending&&(s.revision!==pending.source||epoch(s)!==pending.epoch))pending=null;
 latest=s;queueMicrotask(finish);
}});
Gulch.commit=function(data,activity,options){
 const from=latest?.player,to=data?.seed?.entities?.find(e=>e.id==='player');
 const moving=from&&to&&from.map===to.map&&(from.x!==to.x||from.y!==to.y)&&!window.GulchMovementState?.inFlight&&!document.hidden;
 const started=performance.now(),source=latest?.revision,run=epoch(latest);
 const result=baseCommit.call(this,data,activity,options);
 if(moving&&window.GulchMovementState?.inFlight){push(preparation,performance.now()-started);pending={started,source,epoch:run};}
 return result;
};
window.addEventListener('gulch:recovered',()=>queueMicrotask(finish));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pending=null;});
function el(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
function example(parent,title,source){
 parent.append(el('h4',title));
 const code=el('pre',source);code.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;user-select:text!important;-webkit-user-select:text!important;font:11px/1.6 monospace';parent.append(code);
}
function mount(){
 const help=document.getElementById('keyHelp');if(!help)return;
 help.style.overflowY='auto';help.style.maxHeight='calc(100% - 150px)';
 const section=el('details');section.append(el('summary','Latency measurements & localhost testing'));
 output=el('p');
 const refresh=el('button','Refresh movement timings');refresh.type='button';refresh.addEventListener('click',render);
 section.append(output,refresh,
 el('p','No artificial network-delay setting or hardcoded 1000 ms ping was found in the supplied source files. Unattached files and host settings were not inspected. The one-second timers in the wait-history and live-metrics components update their displays; they do not delay packets. Movement cadence, combat cooldowns and recovery backoff are separate gameplay/protocol timers.'),
 el('p','For an external local project, turn off network emulation in the editor or networking package that enabled it. Reset added latency and jitter to 0 ms, packet loss and duplication to 0%, and remove bandwidth throttling. Also disable browser developer-tools throttling and any external traffic shaper. Exact controls depend on the engine version and networking package; Unity, Unreal, Godot and GameMaker do not share one project setting.'),
 el('p','This browser game runs in an opaque iframe without network access. It cannot connect to 127.0.0.1, start a listener, change host settings, or bypass the room relay. The following examples are text for a separate local development environment. They do not execute here or alter shared gameplay.'),
 el('p','Example using Godot 4: run the Python echo server below on the same computer as the Godot client. Attach the GDScript to a Node in a disposable scene. Each probe carries a unique token; only a successful matching echo is timed. Timing uses one monotonic client clock. It measures local HTTP application RTT, including connection setup and scheduling, not raw ICMP ping. Zero milliseconds is not guaranteed.'));
 example(section,'External echo server — Python 3, standard library',
 'from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer\n\nclass Echo(BaseHTTPRequestHandler):\n    def do_POST(self):\n        if self.path != "/echo":\n            self.send_error(404)\n            return\n        try:\n            size = int(self.headers.get("Content-Length", "0"))\n        except ValueError:\n            self.send_error(400)\n            return\n        if not 1 <= size <= 128:\n            self.send_error(413)\n            return\n        self.connection.settimeout(3)\n        payload = self.rfile.read(size)\n        if len(payload) != size:\n            self.send_error(400)\n            return\n        self.send_response(200)\n        self.send_header("Content-Type", "text/plain")\n        self.send_header("Content-Length", str(len(payload)))\n        self.end_headers()\n        self.wfile.write(payload)\n\n    def log_message(self, *args):\n        pass\n\nserver = ThreadingHTTPServer(("127.0.0.1", 8765), Echo)\nprint("Local echo on 127.0.0.1:8765; Ctrl+C stops it")\ntry:\n    server.serve_forever()\nexcept KeyboardInterrupt:\n    pass\nfinally:\n    server.server_close()');
 example(section,'External Godot 4 client — attach to a Node',
 'extends Node\n\nfunc _ready() -> void:\n    var http := HTTPRequest.new()\n    add_child(http)\n    http.timeout = 3.0\n    var samples: Array[float] = []\n    for i in range(10):\n        var token := "%d:%d" % [i, Time.get_ticks_usec()]\n        var started := Time.get_ticks_usec()\n        var error := http.request(\n            "http://127.0.0.1:8765/echo",\n            PackedStringArray(["Content-Type: text/plain"]),\n            HTTPClient.METHOD_POST, token)\n        if error != OK:\n            push_warning("Probe could not start: %s" % error)\n            break\n        var response: Array = await http.request_completed\n        var elapsed_ms := (Time.get_ticks_usec() - started) / 1000.0\n        var body: PackedByteArray = response[3]\n        if response[0] == HTTPRequest.RESULT_SUCCESS and response[1] == 200 and body.get_string_from_utf8() == token:\n            samples.append(elapsed_ms)\n            print("Local HTTP RTT: %.3f ms" % elapsed_ms)\n        else:\n            push_warning("Failed or mismatched echo; excluded from RTT")\n        await get_tree().create_timer(0.2).timeout\n    if not samples.is_empty():\n        samples.sort()\n        var middle := int(samples.size() / 2)\n        var median := samples[middle]\n        if samples.size() % 2 == 0:\n            median = (samples[middle - 1] + median) / 2.0\n        print("Successful probes: %d; median: %.3f ms" % [samples.size(), median])\n    http.queue_free()');
 section.append(el('p','Save the Python example as echo_server.py and start it with python3 echo_server.py outside this sandbox. Run the Godot scene on the same machine. On a phone, container, VM or another computer, 127.0.0.1 refers to that environment itself. A browser export may also require CORS and browser-policy configuration; this example targets native Godot. No CORS change can grant this Gulch iframe network access.'),el('p','For Unity, Unreal or GameMaker, use the same matching-token request/echo pattern with that engine’s HTTP client and monotonic timer. Never use frame counts, a one-second refresh interval, or a pending room operation as a ping measurement. A fast loopback result does not measure or improve the shared room’s relay latency. Examples have not been executed in this source response.'));
 help.append(section);section.addEventListener('toggle',render);render();
}
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();
