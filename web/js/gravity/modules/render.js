// modules/render

define(['jquery', 'underscore'], function ($, _) {

    /**************
     Private
     **************/

    var spacetime = undefined;
    var canvas = undefined;
    var ctx = undefined;
    var renderLoop = undefined;
    var fps = 60;
    var massMultiplier = undefined; // Object size multiplier
    var mouse = {
        visible: false
    };
    var camera = {
        x: 0,
        y: 0,
        zoom: 1,
        getX: function (p_x) {
            return (p_x * this.zoom - this.x * this.zoom);
        },
        getY: function (p_y) {
            return (p_y * this.zoom - this.y * this.zoom);
        },
        getMouseX: function (p_x) {
            return this.x + p_x / this.zoom;
        },
        getMouseY: function (p_y) {
            return this.y + p_y / this.zoom;
        }
    };
    var settings = {
        showGrid: true,
        realisticUiMode: false,
        lockCamera: true
    };

    function clearCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
    }

    function moveCamera(e) {
        switch (String.fromCharCode(e.charCode)) {
            case 'w':
                camera.y -= 10;
                break;
            case 'a':
                camera.x -= 10;
                break;
            case 's':
                camera.y += 10;
                break;
            case 'd':
                camera.x += 10;
                break;
        }
    }

    function centerCamera() {
        var l_spacetime = spacetime.getSpace();
        for (var i = l_spacetime.length - 1; i >= 0; i--) {
            var object = l_spacetime[i];
            if (object.cameraFocus == true) {
                camera.x = object.x - canvas.width / 2 / camera.zoom;
                camera.y = object.y - canvas.height / 2 / camera.zoom;
            }
        }
    }

    function renderObject(object) {
        // --------------------
        // | Draw object path |
        // --------------------
        (function () {
            if (object.path.length > 3) {
                ctx.beginPath();
                ctx.moveTo(
                    camera.getX(object.path[0].x),
                    camera.getY(object.path[0].y)
                );

                for (i = 1; i < object.path.length - 2; i++) {
                    var xc = (object.path[i].x + object.path[i + 1].x) / 2;
                    var yc = (object.path[i].y + object.path[i + 1].y) / 2;

                    ctx.quadraticCurveTo(
                        camera.getX(object.path[i].x),
                        camera.getY(object.path[i].y),
                        camera.getX(xc),
                        camera.getY(yc)
                    );
                }

                // curve through the last two points
                ctx.quadraticCurveTo(
                    camera.getX(object.path[object.path.length - 2].x),
                    camera.getY(object.path[object.path.length - 2].y),
                    camera.getX(object.path[object.path.length - 1].x),
                    camera.getY(object.path[object.path.length - 1].y)
                );

                ctx.lineWidth = 1;
                ctx.strokeStyle = "#666";
                ctx.stroke();
            }
        })();

        // ---------------
        // | Draw object |
        // ---------------
        (function () {
            // radius from volume
            var radius = Math.cbrt(object.mass * object.density * massMultiplier / 4 / 3 * Math.PI);

            if (settings.realisticUiMode === true) {
                var size = (radius * camera.zoom) * 2;
                ctx.drawImage(
                    object.texture,
                    camera.getX(object.x) - (size / 2),
                    camera.getY(object.y) - (size / 2),
                    size,
                    size
                );
                if (object.cameraFocus === true) {
                    //@todo Implement some sort of effect (glowing or something)
                }
            } else {
                ctx.beginPath();
                ctx.arc(
                    camera.getX(object.x),
                    camera.getY(object.y),
                    radius * camera.zoom,
                    0,
                    2 * Math.PI,
                    false
                );

                ctx.strokeStyle = "#666";
                ctx.fillStyle = "#000";
                if (object.cameraFocus === true) {
                    ctx.fillStyle = '#40A2BF';
                }
                ctx.fill();
            }
        })();
    }

    function renderMouse() {
        if (mouse.visible === true) {
            ctx.fillStyle = '#AAA';
            switch (mouse.state) {
                case 'placement':
                    ctx.beginPath();
                    ctx.arc(mouse.x, mouse.y, mouse.radius, 0, 2 * Math.PI, false);
                    ctx.fill();
                    break;
                case 'mass':
                    ctx.beginPath();
                    ctx.arc(mouse.x2, mouse.y2, mouse.radius, 0, 2 * Math.PI, false);
                    ctx.fill();
                    break;
                case 'velocity':
                    // Draw a line between x,y and x2,y2
                    ctx.beginPath();
                    ctx.arc(mouse.x2, mouse.y2, mouse.radius, 0, 2 * Math.PI, false);
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(mouse.x, mouse.y);
                    ctx.lineTo(mouse.x2, mouse.y2);
                    ctx.strokeStyle = '#D55';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    break;
            }
        }
    }

    function renderGrid() {
        var gridSize = 50;
        var gridWidth = Math.ceil(canvas.width / gridSize) + 2;
        var gridHeight = Math.ceil(canvas.height / gridSize) + 2;

        for (var i = gridWidth - 1; i >= 0; i--) {
            ctx.beginPath();

            ctx.moveTo(i * gridSize - (gridSize + camera.x % gridSize), 0);
            ctx.lineTo(i * gridSize - (gridSize + camera.x % gridSize), canvas.height);

            ctx.strokeStyle = '#CCC';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        for (var i = gridHeight - 1; i >= 0; i--) {
            ctx.beginPath();

            ctx.moveTo(0, i * gridSize - (gridSize + camera.y % gridSize));
            ctx.lineTo(canvas.width, i * gridSize - (gridSize + camera.y % gridSize));

            ctx.strokeStyle = '#CCC';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    function renderBackgroundImage() {
        var img = document.getElementById('realistic-background');
        ctx.fillStyle = ctx.createPattern(img, 'repeat');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }


    function renderFrame(spacetime) {
        clearCanvas();
        if (settings.lockCamera === true) {
            centerCamera();
        }

        if (settings.realisticUiMode === true) {
            renderBackgroundImage();
        }

        if (settings.showGrid === true) {
            renderGrid();
        }
        for (var i = spacetime.length - 1; i >= 0; i--) {
            renderObject(spacetime[i]);
        }

        renderMouse();
    }

    /*************
     Public
     *************/

    var api = {};

    api.initialize = function (p_canvas, p_spacetime, p_massMultiplier) {
        canvas = p_canvas;
        ctx = canvas.getContext('2d');
        spacetime = p_spacetime;
        massMultiplier = p_massMultiplier;

        // WASD camera movement
        document.addEventListener('keypress', moveCamera);
    };

    api.startLoop = function () {
        renderLoop = setInterval(function () {
            renderFrame(spacetime.getSpace());
        }, 1000 / fps);
    };

    api.stopLoop = function () {
        clearInterval(renderLoop);
    };

    api.toggleGrid = function () {
        settings.showGrid = !settings.showGrid;
    };

    api.toggleLockCamera = function () {
        settings.lockCamera = !settings.lockCamera;
    };

    api.toggleRealisticUiMode = function () {
        settings.realisticUiMode = !settings.realisticUiMode;
    };

    api.updateMassMultiplier = function (p_massMultiplier) {
        massMultiplier = p_massMultiplier;
    };

    api.changeZoom = function (p_zoom) {
        camera.zoom = p_zoom;
    };

    api.setMouse = function (p_mouse) {
        mouse = p_mouse;
    };

    api.getCamera = function () {
        return camera
    };

    return api;

});
