var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

//var Readable = require( 'stream' ).Readable
var util = require('util')

/*
var ReadStream = function(){
	Readable.call( this, {objectMode: true } );
}
util.inherits( ReadStream, Readable )
*/

var fs = require('fs');

var sampleRate = 44100
var numChannels = 1

console.log( ArrayBuffer, DataView, Float32Array)

app.use(express.static('./public'));

function count(obj) { return Object.keys(obj).length; }
var i = 0;

io.on('connection', function(socket){
	console.log('a user connected ', socket.id );
	++ i;

	socket.buffer = [];
	socket.recLength = 0;
	/*
	//socket.input = new ReadStream()
	socket.output_a = fs.createWriteStream( "./test_"+i+".mp3" );
	socket.encoder = new lame.Encoder( {
		// input
		channels: numChannels,
		bitDepth: 16,
		sampleRate: sampleRate,

		// output
		bitRate: 128,
		outSampleRate: sampleRate,
		mode: lame.STEREO
	})
	socket.encoder.pipe( socket.output_a )
	
	socket.output_a.on('open', function(fd){
		console.log( "open file", socket.output_a.fd)
	})

	socket.output_a.on('finish', function(fd){
		console.log( "Closed File ", socket.output_a.fd)
		
	})


	//console.log( socket.output )
	*/

    socket.on('disconnect', function(){

	    // Save and make mp3
		var buffers ;
		buffers = mergeBuffers( socket.buffer, socket.recLength );

		var dataview = encodeWAV( buffers );
		
		var wave_filename = "./test_"+i+".wav"

		fs.writeFile( wave_filename, new Buffer( dataview ), "binary", function(err){
			console.log( err )
			if( null == err ){
				wave2Mp3( wave_filename )
			}
		});

		//socket.encoder.push( null )
		
	});
	socket.on('record', function( msg ) {

		var temp = JSON.parse( msg )
		temp.length = count( temp )
		socket.buffer.push(  temp  )
		socket.recLength += temp.length

		/*
		// Flating
		var buffer = new ArrayBuffer( temp.length * 2);
		var view = new DataView(buffer);
		floatTo16BitPCM(view, 0, temp);
		socket.encoder.push( new Buffer( buffer ) )
		*/

	});
});


http.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});


/** Wave Util functions */
function mergeBuffers(recBuffers, recLength){
  var result = new Float32Array(recLength);
  var offset = 0;
  for (var i = 0; i < recBuffers.length; i++){
    result.set(recBuffers[i], offset);
    offset += recBuffers[i].length;
  }
  return result;
}

function interleave(inputL, inputR){
  var length = inputL.length + inputR.length;
  var result = new Float32Array(length);

  var index = 0,
    inputIndex = 0;

  while (index < length){
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output, offset, input){
  for (var i = 0; i < input.length; i++, offset+=2){
    var s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view, offset, string){
  for (var i = 0; i < string.length; i++){
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}


function encodeWAV(samples){
  var buffer = new ArrayBuffer(44 + samples.length * 2);
  var view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  //view.setUint16(22, numChannels, true);
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 4, true);
  /* block align (channel count * bytes per sample) */
  //view.setUint16(32, numChannels * 2, true);
  view.setUint16(32, 1 * 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return buffer;
}

var lame = require('lame');

var wav = require('wav');

function wave2Mp3( filename ){
	var input = fs.createReadStream(filename);
	var output = fs.createWriteStream(filename+".mp3");
	var reader = new wav.Reader();

	// we have to wait for the "format" event before we can start encoding
	reader.on('format', onFormat);

	// and start transferring the data
	input.pipe(reader);

	function onFormat (format) {
	  console.error('WAV format: %j', format);

	  // encoding the wave file into an MP3 is as simple as calling pipe()
	  var encoder = new lame.Encoder(format);
	  reader.pipe(encoder).pipe(output);
	}

}