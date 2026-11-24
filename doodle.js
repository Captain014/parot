var doodle = (function() {
    Function.prototype.bind = Function.prototype.bind || function(fixThis) {
        var func = this
        return function() {
            return func.apply(fixThis, arguments)
        }
    }
    var DEBUG = false;
    var _l = function(obj) {
        DEBUG && console && console.log && console.log(obj)
    }
    var html = document.documentElement;
    var requestAnimationFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function(func) {
            setTimeout(func, 17);
        };
    var
        PI_half = Math.PI / 2, resources = {};


    var Stage = function(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.objects = [];
        this.restart_timeout = 800;
        this.paused = false;
        this.destroyed = false;
        return this;
    };

    var fps = 0, now, lastUpdate = (new Date) * 1 - 1;

    var fpsFilter = 50;
    var set_fps = function() {
        var thisFrameFPS = 1000 / ((now = new Date) - lastUpdate);
        fps += (thisFrameFPS - fps) / fpsFilter;
        lastUpdate = now;
    }


    Stage.prototype.frame = function() {
        if (this.destroyed) {
            return;
        }

        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)

        for (var i in this.objects) {
            if (this.objects[i].destroyed == true) {
                this.objects.splice(i, 1)
            } else {
                this.objects[i].tick(this.ctx)
            }
        }

        if (this.objects.length == 0) {
            var self = this
            setTimeout(function() {
                _l("restarting in " + self.restart_timeout)
                self.setup();
                self.frame();
            }, this.restart_timeout);
        } else if (!this.paused) {
            requestAnimationFrame(this.frame.bind(this))
        }

    };

    Stage.prototype.setup = function() {
        this.objects.push(getRandomFormation(this));
    };

    Stage.prototype.destroy = function() {
        this.destroyed = true;
        this.objects = [];
    }

    var Formation = function(x, y) {
        this.x = x;
        this.y = y;
        this.planes = [];
    };

    Formation.prototype.addPlane = function(formation_x, formation_y, color) {
        var plane_x = this.x + formation_x, plane_y = this.y + formation_y;
        var plane = new JetPlane(resources.jet_img, plane_x, plane_y, color, formation_x, formation_y);
        this.planes.push(plane);
        return plane;
    };

    Formation.prototype.travelTo = function(x, y, v) {
        var f_plane;
        for (var i in this.planes) {
            f_plane = this.planes[i];
            f_plane.travelTo(f_plane.formation_x + x, f_plane.formation_y + y, v)
        }
    };

    Formation.prototype.tick = function(ctx) {

        for (var i in this.planes) {
            if (this.planes[i].destroyed) {
                _l("deleting plane " + i)
                this.planes.splice(i, 1);
            } else {
                this.planes[i].tick(ctx);
            }
        }

        if (this.planes.length == 0) {
            this.destroy();
        }
    };

    Formation.prototype.destroy = function() {
        this.destroyed = true;
    };

    var getRandomFormation = function(stage) {
        var canvasWidth = stage.ctx.canvas.width;
        var canvasHeight = stage.ctx.canvas.height;

        // বিভিন্ন দিক থেকে প্লেন আসার জন্য র‍্যান্ডম রুট প্যাটার্ন (০ থেকে ৩ পর্যন্ত ৪টি ডিরেকশন)
        var directionType = Math.floor(Math.random() * 4);
        var init_x, init_y, target_x, target_y;

        if (directionType === 0) {
            // ১. বাম দিক থেকে ডান দিকে
            init_x = -100;
            init_y = Math.random() * (canvasHeight * 0.7) + (canvasHeight * 0.15);
            target_x = canvasWidth + 200;
            target_y = init_y + (Math.random() * 200 - 100);
        } else if (directionType === 1) {
            // ২. ডান দিক থেকে বাম দিকে
            init_x = canvasWidth + 100;
            init_y = Math.random() * (canvasHeight * 0.7) + (canvasHeight * 0.15);
            target_x = -200;
            target_y = init_y + (Math.random() * 200 - 100);
        } else if (directionType === 2) {
            // ৩. নিচ থেকে ওপরের দিকে
            init_x = Math.random() * (canvasWidth * 0.7) + (canvasWidth * 0.15);
            init_y = canvasHeight + 100;
            target_x = init_x + (Math.random() * 200 - 100);
            target_y = -200;
        } else {
            // ৪. কোণাকুণি (উপরের বাম কোণ থেকে নিচের ডান কোণ)
            init_x = -100;
            init_y = -100;
            target_x = canvasWidth + 200;
            target_y = canvasHeight + 200;
        }

        _l("starting from:" + init_x + " ," + init_y);
        var formation = new Formation(init_x, init_y);

        formation.addPlane(0, -0, "0, 128, 0");
        formation.addPlane(20, -30, "0, 128, 0");
        formation.addPlane(40, -60, "255, 0, 0");
        formation.addPlane(60, -60, "255, 0, 0");
        formation.addPlane(80, -30, "0, 128, 0");
        formation.addPlane(100, 0, "0, 128, 0");

        var dx = target_x - init_x;
        var dy = target_y - init_y;
        formation.travelTo(dx, dy, 3.5 + 2 * Math.random());
        return formation;
    };

    var JetPlane = function(img, initX, initY, smoke_rgb, formation_x, formation_y) {
        this.img = img
        this.x = initX;
        this.y = initY;
        this.formation_x = formation_x;
        this.formation_y = formation_y
        this.smoke_particles_list = [];
        this.smoke_rgb = smoke_rgb;
        this.destroy_plane = false;
        this.pather = new PathMaker();
        return this;
    };

    JetPlane.prototype.draw = function (ctx) {
        ctx.save();
        var angle = Math.atan2(this.pather.delta_y, this.pather.delta_x) + PI_half;
        ctx.translate(this.x, this.y);
        ctx.rotate(angle)

        ctx.drawImage(this.img, 0, 0);
        ctx.restore();

        for (var i in this.smoke_particles_list) {
            if (this.smoke_particles_list[i].destroyed == true) {
                this.smoke_particles_list.splice(i, 1);
            } else {
                this.smoke_particles_list[i].draw(ctx);
            }
        }

    }

    JetPlane.prototype.travelTo = function(_x, _y, v) {
        this.pather.createPath(this.x, this.y, this.x + _x, this.y + _y, v);
    }

    JetPlane.prototype.tick = function(ctx) {
        this.pather.move();
        var angle = Math.atan2(this.pather.delta_y, this.pather.delta_x) + PI_half;
        var adj_x = - this.formation_x + this.formation_x * Math.cos(angle) - this.formation_y * Math.sin(angle);
        var adj_y = - this.formation_y + this.formation_x * Math.sin(angle) + this.formation_y * Math.cos(angle);
        this.x = this.pather.x + adj_x;
        this.y = this.pather.y + adj_y;
        
        if (this.smoke_particles_list.length < 100 && !this.destroy_plane) {
            var delta_x = (11 + 2 * Math.random()) * Math.cos(angle) - (29 + 4 * Math.random()) * Math.sin(angle);
            var delta_y = (11 + 2 * Math.random()) * Math.sin(angle) + (29 + 4 * Math.random()) * Math.cos(angle);
            var smoke_particle = new SmokeParticle(this.x + delta_x, this.y + delta_y, this.smoke_rgb)
            this.smoke_particles_list.push(smoke_particle);
        }
        this.draw(ctx);

        var bbw = 250; // bounding box width expanded for safe screen clearing
        if (this.x > ctx.canvas.width + bbw || this.y > ctx.canvas.height + bbw || this.x < 0 - bbw || this.y < 0 - bbw) {
            this.destroy_plane = true;
        } else {
            this.destroy_plane = false;
        }

        if (this.destroy_plane && this.smoke_particles_list.length == 0) {
            this.destroy()
        }

    };

    JetPlane.prototype.destroy = function() {
        this.destroyed = true;
    }


    var PathMaker = function() {
        this.speed = 2.5;
        this.x = 0;
        this.y = 0;
        this.delta_x = 0;
        this.delta_y = 0;
        this.distance = 0;
        this.traveled = 0;
        this.x1 = 0;
        this.y1 = 0;
        this.x2 = 0;
        this.y2 = 0;
    };

    PathMaker.prototype.createPath = function(x1, y1, x2, y2, v) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.x = x1;
        this.y = y1;
        this.delta_x = x2 - x1;
        this.delta_y = y2 - y1;
        this.distance = Math.sqrt(this.delta_x * this.delta_x + this.delta_y * this.delta_y);
        this.speed = v;
        this.traveled = 0;
    }

    PathMaker.prototype.setSpeed = function (v) {
        this.speed = v;
    }

    PathMaker.prototype.move = function () {
        if (this.distance > 0) {
            this.traveled += this.speed;
            var ratio = this.traveled / this.distance;
            if (ratio > 1) ratio = 1;
            this.x = this.x1 + this.delta_x * ratio;
            this.y = this.y1 + this.delta_y * ratio;
        }
    }


    var SmokeParticle = function (paramX, paramY, rgb) {
        this.x = paramX;
        this.y = paramY;
        this.opacity = 0.5
        this.radius = 2 + Math.random();
        this.rgb = rgb;
    };

    SmokeParticle.prototype.draw = function(ctx) {
        ctx.save();

        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + this.rgb + ',' + this.opacity + ')';
        ctx.shadowColor = 'rgba(' + this.rgb + ',1)';

        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, true);
        ctx.fill();

        this.radius = this.radius + 0.05;
        this.opacity = this.opacity - 0.005;
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
        stage = new Stage(canvas);
        resources.jet_img = new Image();
        resources.jet_img.src = jet_img_src;
        resources.jet_img.onload = function() {
            stage.setup();
            requestAnimationFrame(stage.frame.bind(stage))
        }

    };

    var destroy = function() {
        stage.destroy();
        setTimeout(function() {
            document.body.removeChild(document.getElementById("canvas_doodle"));
        }, 50);
        delete stage;
    }

    return {
        "init":init,
        "destroy":destroy
    }

})();
