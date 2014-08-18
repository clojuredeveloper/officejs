/*global window, rJS, RSVP, console, URL, Math, parseInt, document, jIO,
  Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array,
  Audio, loopEventListener, jQuery, promiseEventListener, Blob*/
/*jslint nomen: true, maxlen:180 */


/* The MediaSource API only supports MPEG-DASH and 
 * VP8 with keyframed segments currently.
 * more info:
 *https://dvcs.w3.org/hg/html-media/raw-file/tip/media-source/media-source.html
 */



(function (window, rJS, RSVP, loopEventListener, $, promiseEventListener) {
  "use strict";
  var gk = rJS(window),
    MediaSource = window.MediaSource || window.WebKitMediaSource
      || window.mozMediaSource;

  function timeFormat(seconds) {
    var result = '00:' + Math.round(seconds),
      min,
      sec;
    if (seconds > 59) {
      min = Math.floor(seconds / 60);
      sec = Math.floor(seconds % 60);
      result = (min > 9 ? min : ('0' + min)) +
        ':' + (sec > 9 ? sec : ('0' + sec));
    }
    return result;
  }

  gk.declareAcquiredMethod("jio_getAttachment", "jio_getAttachment")
    .declareAcquiredMethod("jio_get", "jio_get")
    .declareAcquiredMethod("jio_put", "jio_put")
    .declareAcquiredMethod("jio_remove", "jio_remove")
    .declareAcquiredMethod("plSave", "plSave")
    .declareAcquiredMethod("plGive", "plGive")
    .declareAcquiredMethod("displayThisPage", "displayThisPage")
    .declareAcquiredMethod("displayThisTitle", "displayThisTitle")
    .declareAcquiredMethod("allDocs", "allDocs")
    .declareAcquiredMethod("plEnablePage", "plEnablePage")
    .declareAcquiredMethod("pleaseRedirectMyHash", "pleaseRedirectMyHash")
    .declareMethod("render", function (options) {
      var g = this;
      if (options.id) {
        return new RSVP.Queue()
          .push(function () {
            g.currentId = options.id;
            return g.jio_get({"_id" : options.id});
          })
          .push(function (result) {
            var share_context = g.__element.getElementsByClassName("share")[0];
            share_context.href =
              "https://twitter.com/intent/tweet?hashtags=MusicPlayer&text="
              + encodeURI(result.data.title);
            g.metadata = result.data;
            return g.displayThisTitle(options.action + " : "
                                      + result.data.title);
          })
          .push(function () {
            return g.allDocs({"include_docs": true});
          })
          .push(function (e) {
            var list =  e.data.rows,
              id,
              index = 0,
              control = "control";
            if (list.length === 1) {
              id = g.currentId;
            } else {
              do {
                index = Math.floor(Math.random() * list.length);
                id = list[index].id;
              } while (g.currentId === id);
            }
            if (list[index].doc.format === "video/webm" ||
                list[index].doc.format === "video/mp4") {
              control = "video_control";
            }
            return g.displayThisPage({page: control,
                                      id : id,
                                      action : options.action});
          })
          .push(function (url) {
            g.__element.getElementsByClassName("next")[0].href = url;
            g.index = 3500000;
            return g.jio_getAttachment({"_id" : g.currentId,
                                        "_attachment" : "enclosure",
                                        "_start": 0,
                                        "_end": 3500000});
          })
          .push(function (blob) {
            g.sourceBuffer = g.mediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');
            return jIO.util.readBlobAsArrayBuffer(blob).then(function (e) {
              g.buffer = e.target.result;
              g.fin = true;
            });
          })
          .push(undefined, function (error) {
            if (!(error instanceof RSVP.CancellationError)) {
              g.rebuild = true;
              //xxx
              g.sourceBuffer = new Audio();
              return;
              /* if (MediaSource) {
                 window.location = g.__element
                  .getElementsByClassName("next")[0].href;
                  if ((error.status === 404)
                  && (error.method === "getAttachment")) {
                  return g.jio_remove({"_id" : error.id});
                  }
                  }*/
            }
          });
      }
    })
    .declareMethod("startService", function () {
      var g = this,
        blob;
      return new RSVP.Queue()
        .push(function () {
          if (g.rebuild) {
            return g.jio_getAttachment({"_id" : g.currentId,
                                        "_attachment" : "enclosure"});
          }
        })
        .push(function (result) {
          blob = result;
          return g.plEnablePage();
        })
        .push(function () {
          if (g.rebuild) {
            g.video.src = URL.createObjectURL(blob);
            g.video.load();
            g.video.play();
            return promiseEventListener(g.video, "loadedmetadata", false);
          }
        })
        .push(function () {
          if (g.rebuild) {
            if (g.metadata.time === undefined) {
              return g.jio_put({"_id": g.currentId,
                                "title" : g.metadata.title,
                                "type" : g.metadata.type,
                                "format" : g.metadata.type,
                                "size" : g.metadata.size,
                                "artist" : g.metadata.artist,
                                "album" : g.metadata.album,
                                "year" : g.metadata.year,
                                "picture" : g.metadata.picture,
                                "modified" : g.metadata.modified,
                                "date" : g.metadata.date,
                                "time": timeFormat(g.video.duration)});
            }
          } else {
            g.sourceBuffer.appendBuffer(new Uint8Array(g.buffer));
            g.video.play();
          }
        })
        .push(function () {
          return RSVP.any([
            loopEventListener(g.sourceBuffer, "updateend", false, function () {
              g.buffedTime = g.sourceBuffer.buffered.end(0);
              if (!g.fin) {
                return;
              }
              g.fin = false;
              if (g.index >= g.metadata.size) {
                g.mediaSource.endOfStream();
                if (g.metadata.time === undefined) {
                  return g.jio_put({"_id": g.currentId,
                                    "title" : g.metadata.title,
                                    "type" : g.metadata.type,
                                    "format" : g.metadata.type,
                                    "size" : g.metadata.size,
                                    "artist" : g.metadata.artist,
                                    "album" : g.metadata.album,
                                    "year" : g.metadata.year,
                                    "picture" : g.metadata.picture,
                                    "modified" : g.metadata.modified,
                                    "date" : g.metadata.date,
                                    "time": timeFormat(g.video.duration)});
                }
                return;
              }
              return g.jio_getAttachment({"_id" : g.currentId,
                                          "_attachment" : "enclosure",
                                          "_start": g.index,
                                          "_end": g.index + 3500000})
                .then(function (blob) {
                  g.index += 3500000;
                  return jIO.util.readBlobAsArrayBuffer(blob);
                })
                .then(function (e) {
                  g.fin = true;
                  g.sourceBuffer.appendBuffer(new Uint8Array(e.target.result));
                });
            }),
            loopEventListener(g.video, "ended", false, function () {
              window.location = g.__element
                .getElementsByClassName("next")[0].href;
            }),
            loopEventListener(g.video, "seeking", false, function (e) {
              if (g.rebuild === false) {
                if (g.buffedTime === undefined) {
                  g.video.currentTime = 0;
                } else {
                  if (g.video.currentTime > g.buffedTime) {
                    g.video.currentTime = g.buffedTime;
                  }
                }
              }
            })
          ]);
        });
    });
  gk.ready(function (g) {
    var info;
    g.video = g.__element.getElementsByTagName('video')[0];
    if (MediaSource === undefined) {
      info = g.__element.getElementsByClassName('info')[0];
      info.innerHTML = "<ul>
<li>for a better performance, pleasa enable MediaSource</li>
<li>1.Type about:config into the web browser's address bar and hit enter.
Confirm that you will be careful if a warning message is displayed.</li>
<li>2.search for media.mediasource.enabled and double-click the name.</li>
</ul>";
      return;
    }
    g.seeking = false;
    g.mediaSource = new MediaSource();
    g.video.src = URL.createObjectURL(g.mediaSource);
  });
}(window, rJS, RSVP, loopEventListener, jQuery, promiseEventListener));
