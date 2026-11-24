var doodle = (function() {
    Function.prototype.bind = Function.prototype.bind || function(fixThis) {
        var func = this;
        return function() {
            return func.apply(fixThis, arguments);
        };
    };

    var DEBUG = false;
    var _l = function(obj) {
        DEBUG && console && console.log && console.log(obj);
    };

    var html = document.documentElement;
    var requestAnimationFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function(func) {
            setTimeout(func, 17);
        };

    var PI_half = Math.PI / 2;
    var resources = {};

    // ==================== Stage ====================
    var Stage = function(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.objects = [];
        this.restart_timeout = 900;
        this.paused = false;
        this.destroyed = false;
    };

    Stage.prototype.frame = function() {
        if (this.destroyed) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // পেছন থেকে মুছে ফেলা নিরাপদ
        for (var i = this.objects.length - 1; i >= 0; i--) {
            if (this.objects[i].destroyed) {
                this.objects.splice(i, 1);
            } else {
                this.objects[i].tick(this.ctx);
            }
        }

        if (this.objects.length === 0) {
            var self = this;
            setTimeout(function() {
                if (!self.destroyed) {
                    self.setup();
                    self.frame();
                }
            }, this.restart_timeout);
        } else if (!this.paused) {
            requestAnimationFrame(this.frame.bind(this));
        }
    };

    Stage.prototype.setup = function() {
        this.objects.push(getRandomFormation(this));
    };

    Stage.prototype.destroy = function() {
        this.destroyed = true;
        this.objects = [];
    };

    // ==================== Formation ====================
    var Formation = function(stage, initX, initY, targetX, targetY, speed) {
        this.stage = stage;
        this.planes = [];
        this.destroyed = false;

        this.pather = new PathMaker();
        this.pather.createPath(initX, initY, targetX, targetY, speed);

        this.angle = Math.atan2(targetY - initY, targetX - initX) + PI_half;
    };

    Formation.prototype.addPlane = function(fx, fy, color) {
        this.planes.push({
            formation_x: fx,
            formation_y: fy,
            smoke_rgb: color,
            smoke_particles: []
        });
    };

    Formation.prototype.tick = function(ctx) {
        if (this.destroyed) return;

        this.pather.move();

        // দিক আপডেট
        if (this.pather.delta_x !== 0 || this.pather.delta_y !== 0) {
            this.angle = Math.atan2(this.pather.delta_y, this.pather.delta_x) + PI_half;
        }

        var cosA = Math.cos(this.angle);
        var sinA = Math.sin(this.angle);
        var originX = this.pather.x;
        var originY = this.pather.y;

        var allSmokeGone = true;
        var outOfBounds = false;

        for (var i = 0; i < this.planes.length; i++) {
            var p = this.planes[i];

            // রোটেটেড পজিশন
            var px = originX + (p.formation_x * cosA - p.formation_y * sinA);
            var py = originY + (p.formation_x * sinA + p.formation_y * cosA);

            // প্লেন ড্র
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(this.angle);
            ctx.drawImage(resources.jet_img, 0, 0);
            ctx.restore();

            // স্মোক যোগ
            if (p.smoke_particles.length < 90 && this.pather.traveled < this.pather.distance * 0.95) {
                var sx = (11 + 2 * Math.random()) * cosA - (28 + 4 * Math.random()) * sinA;
                var sy = (11 + 2 * Math.random()) * sinA + (28 + 4 * Math.random()) * cosA;
                p.smoke_particles.push(new SmokeParticle(px + sx, py + sy, p.smoke_rgb));
            }

            // স্মোক ড্র ও ক্লিন
            for (var j = p.smoke_particles.length - 1; j >= 0; j--) {
                var smoke = p.smoke_particles[j];
                if (smoke.destroyed) {
                    p.smoke_particles.splice(j, 1);
                } else {
                    smoke.draw(ctx);
                    allSmokeGone = false;
                }
            }

            // বাউন্ড চেক
            var margin = 280;
            if (px < -margin || px > ctx.canvas.width + margin ||
                py < -margin || py > ctx.canvas.height + margin) {
                outOfBounds = true;
            }
        }

        // পথ শেষ + বাইরে চলে গেছে + স্মোক শেষ → ধ্বংস
        if ((this.pather.traveled >= this.pather.distance && outOfBounds) || 
            (this.pather.traveled >= this.pather.distance && allSmokeGone)) {
            this.destroyed = true;
        }
    };

    // ==================== PathMaker ====================
    var PathMaker = function() {
        this.x = 0;
        this.y = 0;
        this.delta_x = 0;
        this.delta_y = 0;
        this.distance = 0;
        this.traveled = 0;
        this.speed = 3;
        this.x1 = 0;
        this.y1 = 0;
    };

    PathMaker.prototype.createPath = function(x1, y1, x2, y2, v) {
        this.x1 = x1;
        this.y1 = y1;
        this.x = x1;
        this.y = y1;
        this.delta_x = x2 - x1;
        this.delta_y = y2 - y1;
        this.distance = Math.sqrt(this.delta_x * this.delta_x + this.delta_y * this.delta_y) || 1;
        this.speed = v || 3.5;
        this.traveled = 0;
    };

    PathMaker.prototype.move = function() {
        if (this.traveled < this.distance) {
            this.traveled += this.speed;
            if (this.traveled > this.distance) this.traveled = this.distance;
            var ratio = this.traveled / this.distance;
            this.x = this.x1 + this.delta_x * ratio;
            this.y = this.y1 + this.delta_y * ratio;
        }
    };

    // ==================== Smoke ====================
    var SmokeParticle = function(x, y, rgb) {
        this.x = x;
        this.y = y;
        this.opacity = 0.55;
        this.radius = 1.8 + Math.random() * 1.4;
        this.rgb = rgb;
        this.destroyed = false;
    };

    SmokeParticle.prototype.draw = function(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + this.rgb + ',' + this.opacity + ')';
        ctx.shadowColor = 'rgba(' + this.rgb + ',0.9)';
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        this.radius += 0.06;
        this.opacity -= 0.0065;
        if (this.opacity <= 0) this.destroyed = true;
    };

    // ==================== Random Formation ====================
    var getRandomFormation = function(stage) {
        var w = stage.canvas.width;
        var h = stage.canvas.height;

        var type = Math.floor(Math.random() * 4);
        var ix, iy, tx, ty;

        if (type === 0) {          // বাম → ডান
            ix = -120;
            iy = h * 0.2 + Math.random() * h * 0.6;
            tx = w + 220;
            ty = iy + (Math.random() * 160 - 80);
        } else if (type === 1) {   // ডান → বাম
            ix = w + 120;
            iy = h * 0.2 + Math.random() * h * 0.6;
            tx = -220;
            ty = iy + (Math.random() * 160 - 80);
        } else if (type === 2) {   // নিচ → উপর
            ix = w * 0.2 + Math.random() * w * 0.6;
            iy = h + 120;
            tx = ix + (Math.random() * 160 - 80);
            ty = -220;
        } else {                   // তির্যক
            ix = -120;
            iy = -120;
            tx = w + 220;
            ty = h + 220;
        }

        var speed = 3.2 + Math.random() * 2.3;
        var formation = new Formation(stage, ix, iy, tx, ty, speed);

        // ফরমেশন শেপ (V আকৃতির)
        formation.addPlane(0,   0,   "0, 140, 0");
        formation.addPlane(22, -32,  "0, 140, 0");
        formation.addPlane(44, -64,  "220, 30, 30");
        formation.addPlane(66, -64,  "220, 30, 30");
        formation.addPlane(88, -32,  "0, 140, 0");
        formation.addPlane(110, 0,   "0, 140, 0");

        return formation;
    };

    // ==================== Init / Destroy ====================
    var stage = null;

    var init = function(jet_img_src) {
        var canvas = document.createElement('canvas');
        canvas.id = "canvas_doodle";
        canvas.width = window.innerWidth || html.clientWidth;
        canvas.height = window.innerHeight || html.clientHeight;

        var style = canvas.style;
        style.position = 'fixed';
        style.top = '0';
        style.left = '0';
        style.zIndex = '1138';
        style.pointerEvents = 'none';

        document.body.appendChild(canvas);

        stage = new Stage(canvas);

        resources.jet_img = new Image();
        resources.jet_img.src = jet_img_src;
        resources.jet_img.onload = function() {
            stage.setup();
            requestAnimationFrame(stage.frame.bind(stage));
        };
    };

    var destroy = function() {
        if (stage) {
            stage.destroy();
            stage = null;
        }
        setTimeout(function() {
            var el = document.getElementById("canvas_doodle");
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }, 40);
    };

    return {
        init: init,
        destroy: destroy
    };
})();
