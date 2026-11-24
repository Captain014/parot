var doodle = (function () {
    var requestAnimationFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (cb) { setTimeout(cb, 16); };

    var resources = {};
    var stage = null;

    function Stage(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.objects = [];
        this.destroyed = false;
        this.restartDelay = 1000;
    }

    Stage.prototype.frame = function () {
        if (this.destroyed) return;

        var ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (var i = this.objects.length - 1; i >= 0; i--) {
            if (this.objects[i].destroyed) {
                this.objects.splice(i, 1);
            } else {
                this.objects[i].update(ctx);
            }
        }

        if (this.objects.length === 0) {
            var self = this;
            setTimeout(function () {
                if (!self.destroyed) {
                    self.spawn();
                    self.frame();
                }
            }, this.restartDelay);
        } else {
            requestAnimationFrame(this.frame.bind(this));
        }
    };

    Stage.prototype.spawn = function () {
        this.objects.push(createFormation(this));
    };

    Stage.prototype.destroy = function () {
        this.destroyed = true;
        this.objects = [];
    };

    // ==================== Formation ====================
    function createFormation(stage) {
        var w = stage.canvas.width;
        var h = stage.canvas.height;

        var type = Math.floor(Math.random() * 4);
        var startX, startY, endX, endY;

        if (type === 0) { // left → right
            startX = -150; startY = h * 0.25 + Math.random() * h * 0.5;
            endX = w + 250; endY = startY + (Math.random() * 120 - 60);
        } else if (type === 1) { // right → left
            startX = w + 150; startY = h * 0.25 + Math.random() * h * 0.5;
            endX = -250; endY = startY + (Math.random() * 120 - 60);
        } else if (type === 2) { // bottom → top
            startX = w * 0.25 + Math.random() * w * 0.5; startY = h + 150;
            endX = startX + (Math.random() * 120 - 60); endY = -250;
        } else { // diagonal
            startX = -150; startY = -150;
            endX = w + 250; endY = h + 250;
        }

        var speed = 3.5 + Math.random() * 2;
        var formation = {
            x: startX,
            y: startY,
            targetX: endX,
            targetY: endY,
            speed: speed,
            progress: 0,
            totalDist: 0,
            angle: 0,
            planes: [],
            destroyed: false
        };

        var dx = endX - startX;
        var dy = endY - startY;
        formation.totalDist = Math.sqrt(dx * dx + dy * dy) || 1;
        formation.angle = Math.atan2(dy, dx) + Math.PI / 2;

        // formation shape
        var offsets = [
            { x: 0, y: 0, color: "0,140,0" },
            { x: 24, y: -34, color: "0,140,0" },
            { x: 48, y: -68, color: "220,30,30" },
            { x: 72, y: -68, color: "220,30,30" },
            { x: 96, y: -34, color: "0,140,0" },
            { x: 120, y: 0, color: "0,140,0" }
        ];

        for (var i = 0; i < offsets.length; i++) {
            formation.planes.push({
                ox: offsets[i].x,
                oy: offsets[i].y,
                color: offsets[i].color,
                smokes: []
            });
        }

        formation.update = function (ctx) {
            if (this.destroyed) return;

            this.progress += this.speed;
            var ratio = Math.min(this.progress / this.totalDist, 1);

            this.x = startX + dx * ratio;
            this.y = startY + dy * ratio;

            var cosA = Math.cos(this.angle);
            var sinA = Math.sin(this.angle);

            var stillHasSmoke = false;
            var img = resources.jet_img;
            var halfW = img.width / 2;
            var halfH = img.height / 2;

            for (var i = 0; i < this.planes.length; i++) {
                var p = this.planes[i];

                var px = this.x + (p.ox * cosA - p.oy * sinA);
                var py = this.y + (p.ox * sinA + p.oy * cosA);

                // ===== সবচেয়ে গুরুত্বপূর্ণ ফিক্স: সেন্টার থেকে রোটেট =====
                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(this.angle);
                ctx.drawImage(img, -halfW, -halfH);   // ← এখানেই আগের বাগ ছিল
                ctx.restore();

                // smoke
                if (ratio < 0.92 && p.smokes.length < 80) {
                    var backX = -28 + Math.random() * 6;
                    var backY = (Math.random() - 0.5) * 10;
                    var sx = px + (backX * cosA - backY * sinA);
                    var sy = py + (backX * sinA + backY * cosA);
                    p.smokes.push({
                        x: sx,
                        y: sy,
                        r: 2 + Math.random() * 1.5,
                        life: 1
                    });
                }

                for (var j = p.smokes.length - 1; j >= 0; j--) {
                    var s = p.smokes[j];
                    s.life -= 0.016;
                    s.r += 0.07;

                    if (s.life <= 0) {
                        p.smokes.splice(j, 1);
                        continue;
                    }

                    ctx.beginPath();
                    ctx.fillStyle = "rgba(" + p.color + "," + (s.life * 0.5) + ")";
                    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                    ctx.fill();
                    stillHasSmoke = true;
                }
            }

            // শেষ হয়ে গেলে ধ্বংস
            if (ratio >= 1 && !stillHasSmoke) {
                this.destroyed = true;
            }
        };

        return formation;
    }

    // ==================== Public API ====================
    function init(jetImageUrl) {
        // আগের ক্যানভাস থাকলে মুছে ফেলো
        destroy();

        var canvas = document.createElement("canvas");
        canvas.id = "canvas_doodle";
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.cssText = "position:fixed;top:0;left:0;z-index:9999;pointer-events:none;";

        document.body.appendChild(canvas);

        stage = new Stage(canvas);

        resources.jet_img = new Image();
        resources.jet_img.onload = function () {
            stage.spawn();
            stage.frame();
        };
        resources.jet_img.src = jetImageUrl;
    }

    function destroy() {
        if (stage) {
            stage.destroy();
            stage = null;
        }
        var old = document.getElementById("canvas_doodle");
        if (old) old.remove();
    }

    return {
        init: init,
        destroy: destroy
    };
})();
