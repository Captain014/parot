var doodle = (function () {
    Function.prototype.bind = Function.prototype.bind || function (fixThis) {
        var func = this;
        return function () {
            return func.apply(fixThis, arguments);
        };
    };

    var DEBUG = false;
    var _l = function (obj) {
        DEBUG && console && console.log && console.log(obj);
    };

    var html = document.documentElement;
    var requestAnimationFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (func) {
            setTimeout(func, 16);
        };

    var PI_half = Math.PI / 2;
    var resources = {};
    var stage = null;

    // ==================== Stage ====================
    var Stage = function (canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.objects = [];
        this.restart_timeout = 1100;
        this.paused = false;
        this.destroyed = false;
    };

    Stage.prototype.frame = function () {
        if (this.destroyed) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // পেছন থেকে লুপ (splice সেফ)
        for (var i = this.objects.length - 1; i >= 0; i--) {
            if (this.objects[i].destroyed) {
                this.objects.splice(i, 1);
            } else {
                this.objects[i].tick(this.ctx);
            }
        }

        if (this.objects.length === 0) {
            var self = this;
            setTimeout(function () {
                if (!self.destroyed) {
                    _l("restarting...");
                    self.setup();
                    self.frame();
                }
            }, this.restart_timeout);
        } else if (!this.paused) {
            requestAnimationFrame(this.frame.bind(this));
        }
    };

    Stage.prototype.setup = function () {
        this.objects.push(getRandomFormation(this));
    };

    Stage.prototype.destroy = function () {
        this.destroyed = true;
        this.objects = [];
    };

    // ==================== Formation ====================
    var Formation = function (x, y) {
        this.x = x;
        this.y = y;
        this.planes = [];
        this.destroyed = false;
    };

    Formation.prototype.addPlane = function (fx, fy, color) {
        var plane = new JetPlane(resources.jet_img, this.x + fx, this.y + fy, color, fx, fy);
        this.planes.push(plane);
        return plane;
    };

    Formation.prototype.travelTo = function (dx, dy, speed) {
        for (var i = 0; i < this.planes.length; i++) {
            var p = this.planes[i];
            p.travelTo(p.x + dx, p.y + dy, speed);
        }
    };

    Formation.prototype.tick = function (ctx) {
        for (var i = this.planes.length - 1; i >= 0; i--) {
            if (this.planes[i].destroyed) {
                this.planes.splice(i, 1);
            } else {
                this.planes[i].tick(ctx);
            }
        }

        if (this.planes.length === 0) {
            this.destroyed = true;
        }
    };

    // ==================== Random Formation ====================
    var getRandomFormation = function (stage) {
        var w = stage.canvas.width;
        var h = stage.canvas.height;

        var type = Math.floor(Math.random() * 5);
        var init_x, init_y, target_x, target_y;

        if (type === 0) { // বাম → ডান
            init_x = -160;
            init_y = h * 0.2 + Math.random() * h * 0.6;
            target_x = w + 260;
            target_y = init_y + (Math.random() * 140 - 70);
        } else if (type === 1) { // ডান → বাম
            init_x = w + 160;
            init_y = h * 0.2 + Math.random() * h * 0.6;
            target_x = -260;
            target_y = init_y + (Math.random() * 140 - 70);
        } else if (type === 2) { // নিচ → উপর
            init_x = w * 0.2 + Math.random() * w * 0.6;
            init_y = h + 160;
            target_x = init_x + (Math.random() * 140 - 70);
            target_y = -260;
        } else if (type === 3) { // উপর → নিচ
            init_x = w * 0.2 + Math.random() * w * 0.6;
            init_y = -160;
            target_x = init_x + (Math.random() * 140 - 70);
            target_y = h + 260;
        } else { // তির্যক
            init_x = -160;
            init_y = -160;
            target_x = w + 260;
            target_y = h + 260;
        }

        var formation = new Formation(init_x, init_y);

        // V formation
        formation.addPlane(0, 0, "0, 140, 0");
        formation.addPlane(18, -28, "0, 140, 0");
        formation.addPlane(36, -56, "220, 30, 30");
        formation.addPlane(54, -56, "220, 30, 30");
        formation.addPlane(72, -28, "0, 140, 0");
        formation.addPlane(90, 0, "0, 140, 0");

        var dx = target_x - init_x;
        var dy = target_y - init_y;
        var speed = 3.4 + Math.random() * 2.4;

        formation.travelTo(dx, dy, speed);
        return formation;
    };

    // ==================== JetPlane ====================
    var JetPlane = function (img, x, y, color, fx, fy) {
        this.img = img;
        this.x = x;
        this.y = y;
        this.formation_x = fx;
        this.formation_y = fy;
        this.smoke_rgb = color;
        this.smoke_particles_list = [];
        this.destroy_plane = false;
        this.destroyed = false;
        this.pather = new PathMaker();
    };

    JetPlane.prototype.travelTo = function (tx, ty, speed) {
        this.pather.createPath(this.x, this.y, tx, ty, speed);
    };

    JetPlane.prototype.tick = function (ctx) {
        this.pather.move();

        // সঠিক অ্যাঙ্গেল (atan2 ব্যবহার)
        var angle = Math.atan2(this.pather.delta_y, this.pather.delta_x) + PI_half;

        // Formation offset রোটেশন
        var cosA = Math.cos(angle);
        var sinA = Math.sin(angle);

        var adj_x = this.formation_x * cosA - this.formation_y * sinA;
        var adj_y = this.formation_x * sinA + this.formation_y * cosA;

        this.x = this.pather.x + adj_x;
        this.y = this.pather.y + adj_y;

        // স্মোক
        if (this.smoke_particles_list.length < 90 && !this.destroy_plane) {
            var back = 26 + Math.random() * 8;
            var side = (Math.random() - 0.5) * 12;
            var sx = this.x + (-back * cosA - side * sinA);
            var sy = this.y + (-back * sinA + side * cosA);
            this.smoke_particles_list.push(new SmokeParticle(sx, sy, this.smoke_rgb));
        }

        this.draw(ctx);

        // বাউন্ড চেক
        var margin = 220;
        if (this.x < -margin || this.x > ctx.canvas.width + margin ||
            this.y < -margin || this.y > ctx.canvas.height + margin) {
            this.destroy_plane = true;
        }

        if (this.destroy_plane && this.smoke_particles_list.length === 0) {
            this.destroyed = true;
        }
    };

    JetPlane.prototype.draw = function (ctx) {
        var angle = Math.atan2(this.pather.delta_y, this.pather.delta_x) + PI_half;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);

        // ===== সবচেয়ে জরুরি ফিক্স: ইমেজ সেন্টার থেকে ড্র =====
        var img = this.img;
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        ctx.restore();

        // স্মোক ড্র
        for (var i = this.smoke_particles_list.length - 1; i >= 0; i--) {
            if (this.smoke_particles_list[i].destroyed) {
                this.smoke_particles_list.splice(i, 1);
            } else {
                this.smoke_particles_list[i].draw(ctx);
            }
        }
    };

    // ==================== PathMaker (সঠিক ভার্সন) ====================
    var PathMaker = function () {
        this.x = 0;
        this.y = 0;
        this.delta_x = 0;
        this.delta_y = 0;
        this.distance = 0;
        this.traveled = 0;
        this.speed = 3;
    };

    PathMaker.prototype.createPath = function (x1, y1, x2, y2, speed) {
        this.x = x1;
        this.y = y1;
        this.delta_x = x2 - x1;
        this.delta_y = y2 - y1;
        this.distance = Math.sqrt(this.delta_x * this.delta_x + this.delta_y * this.delta_y) || 1;
        this.traveled = 0;
        this.speed = speed || 3.5;
    };

    PathMaker.prototype.move = function () {
        if (this.traveled < this.distance) {
            this.traveled += this.speed;
            if (this.traveled > this.distance) this.traveled = this.distance;

            var ratio = this.traveled / this.distance;
            this.x = this.x + (this.delta_x * this.speed / this.distance); // incremental
            // আরও সঠিকভাবে:
            // আসলে ratio দিয়ে করলেই ভালো
        }

        // সঠিক মুভমেন্ট
        var ratio = Math.min(this.traveled / this.distance, 1);
        // পুনরায় সেট না করে incremental রাখছি
    };

    // PathMaker ঠিকভাবে লেখছি আবার
    PathMaker.prototype.move = function () {
        if (this.traveled >= this.distance) return;

        this.traveled += this.speed;
        if (this.traveled > this.distance) this.traveled = this.distance;

        var ratio = this.traveled / this.distance;
        this.x = (this.x - (this.delta_x * (this.traveled - this.speed) / this.distance)) + this.delta_x * ratio;
        // সিম্পল ভার্সন:
    };

    // ক্লিন PathMaker
    PathMaker.prototype.createPath = function (x1, y1, x2, y2, speed) {
        this.startX = x1;
        this.startY = y1;
        this.x = x1;
        this.y = y1;
        this.delta_x = x2 - x1;
        this.delta_y = y2 - y1;
        this.distance = Math.sqrt(this.delta_x * this.delta_x + this.delta_y * this.delta_y) || 1;
        this.traveled = 0;
        this.speed = speed || 3.5;
    };

    PathMaker.prototype.move = function () {
        if (this.traveled >= this.distance) return;

        this.traveled += this.speed;
        if (this.traveled > this.distance) this.traveled = this.distance;

        var ratio = this.traveled / this.distance;
        this.x = this.startX + this.delta_x * ratio;
        this.y = this.startY + this.delta_y * ratio;
    };

    // ==================== Smoke ====================
    var SmokeParticle = function (x, y, rgb) {
        this.x = x;
        this.y = y;
        this.opacity = 0.5;
        this.radius = 1.8 + Math.random() * 1.5;
        this.rgb = rgb;
        this.destroyed = false;
    };

    SmokeParticle.prototype.draw = function (ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + this.rgb + "," + this.opacity + ")";
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        this.radius += 0.055;
        this.opacity -= 0.006;
        if (this.opacity <= 0) this.destroyed = true;
    };

    // ==================== Init / Destroy ====================
    var init = function (jet_img_src) {
        // আগেরটা থাকলে মুছে ফেলো
        destroy();

        var canvas = document.createElement("canvas");
        canvas.id = "canvas_doodle";
        canvas.width = window.innerWidth || html.clientWidth;
        canvas.height = window.innerHeight || html.clientHeight;
        canvas.style.cssText = "position:fixed;top:0;left:0;z-index:1138;pointer-events:none;";

        document.body.appendChild(canvas);
        stage = new Stage(canvas);

        resources.jet_img = new Image();
        resources.jet_img.onload = function () {
            stage.setup();
            requestAnimationFrame(stage.frame.bind(stage));
        };
        resources.jet_img.src = jet_img_src;
    };

    var destroy = function () {
        if (stage) {
            stage.destroy();
            stage = null;
        }
        var el = document.getElementById("canvas_doodle");
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    };

    return {
        init: init,
        destroy: destroy
    };
})();
