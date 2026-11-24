var doodle = (function() {
    Function.prototype.bind = Function.prototype.bind || function(fixThis) {
        var func = this;
        return function() {
            return func.apply(fixThis, arguments);
        };
    };

    var DEBUG = false;
    var _l = function(obj) {
        if (DEBUG && window.console && console.log) {
            console.log(obj);
        }
    };

    var html = document.documentElement;
    var PI_half = Math.PI / 2;
    var resources = {};

    var requestAnimationFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function(func) {
            return setTimeout(func, 16);
        };

    // --- PathMaker: Straight-line movement using atan2 ---
    var PathMaker = function() {
        this.speed = 3;
        this.angle = 0;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
    };

    PathMaker.prototype.createPath = function(x1, y1, x2, y2, speed) {
        this.x = x1;
        this.y = y1;
        var dx = x2 - x1;
        var dy = y2 - y1;
        this.angle = Math.atan2(dy, dx);
        this.speed = (typeof speed === "number" && speed > 0) ? speed : 3;
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
    };

    PathMaker.prototype.setSpeed = function(speed) {
        this.speed = speed;
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
    };

    PathMaker.prototype.move = function() {
        this.x += this.vx;
        this.y += this.vy;
    };

    // --- SmokeParticle ---
    var SmokeParticle = function(x, y, rgb) {
        this.x = x;
        this.y = y;
        this.opacity = 0.55;
        this.radius = 2 + Math.random() * 1.5;
        this.rgb = rgb || "255, 255, 255";
        this.destroyed = false;
    };

    SmokeParticle.prototype.draw = function(ctx) {
        if (this.destroyed) return;

        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + this.rgb + "," + Math.max(0, this.opacity) + ")";
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.restore();

        this.radius += 0.05;
        this.opacity -= 0.006;

        if (this.opacity <= 0) {
            this.destroyed = true;
        }
    };

    // --- JetPlane ---
    var JetPlane = function(img, startX, startY, endX, endY, speed, smokeRgb) {
        this.img = img;
        this.x = startX;
        this.y = startY;
        this.smokeParticles = [];
        this.smokeRgb = smokeRgb || "255, 255, 255";
        this.outOfBounds = false;
        this.destroyed = false;
        this.pather = new PathMaker();
        this.pather.createPath(startX, startY, endX, endY, speed);
    };

    JetPlane.prototype.draw = function(ctx) {
        ctx.save();
        // Plane image assumed pointing UP (0 rad = up, so +PI_half aligns with right)
        var drawAngle = this.pather.angle + PI_half;
        ctx.translate(this.x, this.y);
        ctx.rotate(drawAngle);

        if (this.img && this.img.complete && this.img.naturalWidth > 0) {
            var w = this.img.naturalWidth;
            var h = this.img.naturalHeight;
            ctx.drawImage(this.img, -w / 2, -h / 2, w, h);
        } else {
            // Fallback triangle if image isn't loaded yet
            ctx.beginPath();
            ctx.moveTo(0, -14);
            ctx.lineTo(10, 12);
            ctx.lineTo(-10, 12);
            ctx.closePath();
            ctx.fillStyle = "#ffffff";
            ctx.fill();
        }
        ctx.restore();

        for (var i = this.smokeParticles.length - 1; i >= 0; i--) {
            var p = this.smokeParticles[i];
            if (p.destroyed) {
                this.smokeParticles.splice(i, 1);
            } else {
                p.draw(ctx);
            }
        }
    };

    JetPlane.prototype.tick = function(ctx) {
        this.pather.move();
        this.x = this.pather.x;
        this.y = this.pather.y;

        // Spawn smoke from tail opposite to movement direction
        if (!this.outOfBounds && this.smokeParticles.length < 120) {
            var tailOffset = 18;
            var smokeX = this.x - Math.cos(this.pather.angle) * tailOffset + (Math.random() - 0.5) * 3;
            var smokeY = this.y - Math.sin(this.pather.angle) * tailOffset + (Math.random() - 0.5) * 3;
            this.smokeParticles.push(new SmokeParticle(smokeX, smokeY, this.smokeRgb));
        }

        this.draw(ctx);

        var pad = 80;
        var cw = ctx.canvas.width;
        var ch = ctx.canvas.height;
        this.outOfBounds = (
            this.x > cw + pad ||
            this.y > ch + pad ||
            this.x < -pad ||
            this.y < -pad
        );

        if (this.outOfBounds && this.smokeParticles.length === 0) {
            this.destroy();
        }
    };

    JetPlane.prototype.destroy = function() {
        this.destroyed = true;
    };

    // --- Formation (moves together in one straight line without repeating) ---
    var Formation = function(originX, originY, targetX, targetY, speed) {
        this.originX = originX;
        this.originY = originY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.speed = speed || 3.5;
        this.planes = [];
        this.destroyed = false;
    };

    Formation.prototype.addPlane = function(offsetX, offsetY, smokeRgb) {
        var startX = this.originX + offsetX;
        var startY = this.originY + offsetY;
        var endX = this.targetX + offsetX;
        var endY = this.targetY + offsetY;

        var plane = new JetPlane(
            resources.jet_img,
            startX,
            startY,
            endX,
            endY,
            this.speed,
            smokeRgb
        );
        this.planes.push(plane);
        return plane;
    };

    Formation.prototype.tick = function(ctx) {
        for (var i = this.planes.length - 1; i >= 0; i--) {
            var plane = this.planes[i];
            if (plane.destroyed) {
                _l("removing plane at index " + i);
                this.planes.splice(i, 1);
            } else {
                plane.tick(ctx);
            }
        }

        if (this.planes.length === 0) {
            this.destroy();
        }
    };

    Formation.prototype.destroy = function() {
        this.destroyed = true;
    };

    // --- Single clean formation generator ---
    var createStraightFormation = function(stage) {
        var cw = stage.canvas.width;
        var ch = stage.canvas.height;

        // Start from left side and fly straight across to right side with slight angle
        var startX = -60;
        var startY = ch * (0.25 + Math.random() * 0.5);
        var endX = cw + 80;
        var endY = startY + ((Math.random() - 0.5) * 180);

        var speed = 3.2 + Math.random() * 1.5;
        var formation = new Formation(startX, startY, endX, endY, speed);

        // V-shape formation offsets (all straight parallel paths)
        formation.addPlane(0, 0, "0, 128, 0");
        formation.addPlane(-22, -26, "0, 128, 0");
        formation.addPlane(-44, -52, "255, 0, 0");
        formation.addPlane(-44, 52, "255, 0, 0");
        formation.addPlane(-22, 26, "0, 128, 0");

        return formation;
    };

    // --- Stage (runs once and stops cleanly instead of looping infinitely) ---
    var Stage = function(canvas, options) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.objects = [];
        this.paused = false;
        this.destroyed = false;
        this.loop = !!(options && options.loop); // Default false: no endless repeat
        this.restartTimeout = (options && options.restartTimeout) || 1500;
        this._rafId = null;
        this._timerId = null;
    };

    Stage.prototype.setup = function() {
        this.objects = [];
        this.objects.push(createStraightFormation(this));
    };

    Stage.prototype.frame = function() {
        if (this.destroyed || this.paused) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (var i = this.objects.length - 1; i >= 0; i--) {
            var obj = this.objects[i];
            if (obj.destroyed) {
                this.objects.splice(i, 1);
            } else {
                obj.tick(this.ctx);
            }
        }

        if (this.objects.length > 0) {
            this._rafId = requestAnimationFrame(this.frame.bind(this));
        } else if (this.loop) {
            var self = this;
            this._timerId = setTimeout(function() {
                if (!self.destroyed && !self.paused) {
                    self.setup();
                    self.frame();
                }
            }, this.restartTimeout);
        } else {
            // Finished cleanly once: clear remaining canvas and stop
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            _l("Formation finished cleanly.");
        }
    };

    Stage.prototype.destroy = function() {
        this.destroyed = true;
        this.objects = [];
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        if (this._timerId) {
            clearTimeout(this._timerId);
            this._timerId = null;
        }
    };

    var stage = null;
    var resizeHandler = null;

    var updateCanvasSize = function(canvas) {
        if (!canvas) return;
        canvas.width = window.innerWidth || html.clientWidth || 800;
        canvas.height = window.innerHeight || html.clientHeight || 600;
    };

    var init = function(jetImgSrc, options) {
        // Prevent duplicate canvases if init is called again
        destroy();

        var canvas = document.createElement("canvas");
        canvas.id = "canvas_doodle";
        updateCanvasSize(canvas);

        var style = canvas.style;
        style.position = "fixed";
        style.top = "0";
        style.left = "0";
        style.zIndex = "1138";
        style.pointerEvents = "none";

        document.body.appendChild(canvas);

        resizeHandler = function() {
            updateCanvasSize(canvas);
        };
        window.addEventListener("resize", resizeHandler);

        stage = new Stage(canvas, options);

        resources.jet_img = new Image();
        resources.jet_img.onload = function() {
            if (!stage || stage.destroyed) return;
            stage.setup();
            stage.frame();
        };
        resources.jet_img.onerror = function() {
            _l("Failed to load jet image, running with fallback shape.");
            if (!stage || stage.destroyed) return;
            stage.setup();
            stage.frame();
        };
        resources.jet_img.src = jetImgSrc;
    };

    var destroy = function() {
        if (resizeHandler) {
            window.removeEventListener("resize", resizeHandler);
            resizeHandler = null;
        }
        if (stage) {
            stage.destroy();
            stage = null;
        }
        var existingCanvas = document.getElementById("canvas_doodle");
        if (existingCanvas && existingCanvas.parentNode) {
            existingCanvas.parentNode.removeChild(existingCanvas);
        }
    };

    return {
        init: init,
        destroy: destroy
    };
})();
