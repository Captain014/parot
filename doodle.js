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

    var PI_half = Math.PI / 2,
        resources = {};

    var Stage = function(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.objects = [];
        this.restart_timeout = 800;
        this.paused = false;
        this.destroyed = false;
        this.waitingRestart = false;
        return this;
    };

    Stage.prototype.frame = function() {
        if (this.destroyed) {
            return;
        }

        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        for (var i = this.objects.length - 1; i >= 0; i--) {
            if (this.objects[i].destroyed === true) {
                this.objects.splice(i, 1);
            } else {
                this.objects[i].tick(this.ctx);
            }
        }

        if (this.objects.length === 0) {
            if (!this.waitingRestart && !this.paused) {
                var self = this;
                this.waitingRestart = true;
                setTimeout(function() {
                    self.waitingRestart = false;
                    if (!self.destroyed && !self.paused) {
                        _l("restarting formation...");
                        self.setup();
                        requestAnimationFrame(self.frame.bind(self));
                    }
                }, this.restart_timeout);
            }
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

    var Formation = function(x, y) {
        this.x = x;
        this.y = y;
        this.planes = [];
        this.destroyed = false;
    };

    Formation.prototype.addPlane = function(formation_x, formation_y, color) {
        var plane_x = this.x + formation_x;
        var plane_y = this.y + formation_y;
        var plane = new JetPlane(resources.jet_img, plane_x, plane_y, color, formation_x, formation_y);
        this.planes.push(plane);
        return plane;
    };

    Formation.prototype.travelTo = function(targetX, targetY, v) {
        for (var i = 0; i < this.planes.length; i++) {
            var f_plane = this.planes[i];
            f_plane.travelTo(targetX + f_plane.formation_x, targetY + f_plane.formation_y, v);
        }
    };

    Formation.prototype.tick = function(ctx) {
        for (var i = this.planes.length - 1; i >= 0; i--) {
            if (this.planes[i].destroyed === true) {
                _l("deleting plane " + i);
                this.planes.splice(i, 1);
            } else {
                this.planes[i].tick(ctx);
            }
        }

        if (this.planes.length === 0) {
            this.destroy();
        }
    };

    Formation.prototype.destroy = function() {
        this.destroyed = true;
    };

    // শুধু সোজা বাম -> ডান অথবা সোজা ওপর -> নিচে চলবে
    var getRandomFormation = function(stage) {
        var w = stage.ctx.canvas.width;
        var h = stage.ctx.canvas.height;
        var margin = 100;

        var init_x, init_y, target_x, target_y;
        var goLeftToRight = Math.random() > 0.5;

        if (goLeftToRight) {
            // Left -> Right (straight horizontal)
            init_x = -margin;
            init_y = 100 + Math.random() * Math.max(100, h - 200);
            target_x = w + margin;
            target_y = init_y;
        } else {
            // Top -> Bottom (straight vertical)
            init_x = 100 + Math.random() * Math.max(100, w - 200);
            init_y = -margin;
            target_x = init_x;
            target_y = h + margin;
        }

        _l((goLeftToRight ? "Left->Right" : "Top->Bottom") + " from (" + init_x + "," + init_y + ") to (" + target_x + "," + target_y + ")");

        var formation = new Formation(init_x, init_y);

        formation.addPlane(0, 0, "0, 128, 0");
        formation.addPlane(20, -30, "0, 128, 0");
        formation.addPlane(40, -60, "255, 0, 0");
        formation.addPlane(60, -60, "255, 0, 0");
        formation.addPlane(80, -30, "0, 128, 0");
        formation.addPlane(100, 0, "0, 128, 0");

        var speed = 3.5 + 2 * Math.random();
        formation.travelTo(target_x, target_y, speed);
        return formation;
    };

    var JetPlane = function(img, initX, initY, smoke_rgb, formation_x, formation_y) {
        this.img = img;
        this.x = initX;
        this.y = initY;
        this.formation_x = formation_x;
        this.formation_y = formation_y;
        this.smoke_particles_list = [];
        this.smoke_rgb = smoke_rgb;
        this.destroy_plane = false;
        this.destroyed = false;
        this.pather = new PathMaker();
        return this;
    };

    JetPlane.prototype.draw = function(ctx) {
        ctx.save();
        var angle = this.pather.angle + PI_half;
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);

        var drawW = this.img.width || 32;
        var drawH = this.img.height || 32;
        ctx.drawImage(this.img, -drawW / 2, -drawH / 2);
        ctx.restore();

        for (var i = this.smoke_particles_list.length - 1; i >= 0; i--) {
            if (this.smoke_particles_list[i].destroyed === true) {
                this.smoke_particles_list.splice(i, 1);
            } else {
                this.smoke_particles_list[i].draw(ctx);
            }
        }
    };

    JetPlane.prototype.travelTo = function(_x, _y, v) {
        this.pather.createPath(this.x, this.y, _x, _y, v);
    };

    JetPlane.prototype.tick = function(ctx) {
        this.pather.move();
        this.x = this.pather.x;
        this.y = this.pather.y;

        if (this.smoke_particles_list.length < 100 && !this.destroy_plane) {
            var backX = -Math.cos(this.pather.angle) * 16 + (Math.random() * 4 - 2);
            var backY = -Math.sin(this.pather.angle) * 16 + (Math.random() * 4 - 2);
            var smoke_particle = new SmokeParticle(this.x + backX, this.y + backY, this.smoke_rgb);
            this.smoke_particles_list.push(smoke_particle);
        }

        this.draw(ctx);

        var bbw = 160;
        if (
            this.x > ctx.canvas.width + bbw ||
            this.y > ctx.canvas.height + bbw ||
            this.x < -bbw ||
            this.y < -bbw
        ) {
            this.destroy_plane = true;
        }

        if (this.destroy_plane && this.smoke_particles_list.length === 0) {
            this.destroy();
        }
    };

    JetPlane.prototype.destroy = function() {
        this.destroyed = true;
    };

    var PathMaker = function() {
        this.speed = 2.5;
        this.angle = 0;
        this.x = 0;
        this.y = 0;
        this.delta_x = 0;
        this.delta_y = 0;
    };

    PathMaker.prototype.createPath = function(x1, y1, x2, y2, v) {
        this.x = x1;
        this.y = y1;
        this.delta_x = x2 - x1;
        this.delta_y = y2 - y1;
        this.angle = Math.atan2(this.delta_y, this.delta_x);
        this.speed = v;
    };

    PathMaker.prototype.setSpeed = function(v) {
        this.speed = v;
    };

    PathMaker.prototype.move = function() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    };

    var SmokeParticle = function(paramX, paramY, rgb) {
        this.x = paramX;
        this.y = paramY;
        this.opacity = 0.5;
        this.radius = 2 + Math.random();
        this.rgb = rgb;
        this.destroyed = false;
    };

    SmokeParticle.prototype.draw = function(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + this.rgb + ',' + this.opacity + ')';
        ctx.shadowColor = 'rgba(' + this.rgb + ',1)';
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, true);
        ctx.fill();

        this.radius += 0.05;
        this.opacity -= 0.005;
        if (this.opacity <= 0) {
            this.destroyed = true;
        }
        ctx.restore();
    };

    var stage;
    var init = function(jet_img_src) {
        var canvas = document.createElement('canvas');
        canvas.id = "canvas_doodle";
        canvas.height = window.innerHeight || html.clientHeight;
        canvas.width = window.innerWidth || html.clientWidth;

        var canvasStyle = canvas.style;
        canvasStyle.position = 'fixed';
        canvasStyle.top = 0;
        canvasStyle.left = 0;
        canvasStyle.zIndex = 1138;
        canvasStyle['pointerEvents'] = 'none';
        document.body.appendChild(canvas);

        window.addEventListener('resize', function() {
            if (stage && stage.canvas) {
                stage.canvas.width = window.innerWidth || html.clientWidth;
                stage.canvas.height = window.innerHeight || html.clientHeight;
            }
        });

        stage = new Stage(canvas);
        resources.jet_img = new Image();
        resources.jet_img.src = jet_img_src;
        resources.jet_img.onload = function() {
            stage.setup();
            requestAnimationFrame(stage.frame.bind(stage));
        };
    };

    var destroy = function() {
        if (!stage) return;
        stage.destroy();
        setTimeout(function() {
            var el = document.getElementById("canvas_doodle");
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }, 50);
        stage = null;
    };

    return {
        "init": init,
        "destroy": destroy
    };
})();
