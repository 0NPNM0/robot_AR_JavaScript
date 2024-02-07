const yuvBehavior = Behavior({
    methods: {
        initShader() {//WebGL 上下文对象（gl）是用于与 WebGL API 进行交互的接口
            const gl = this.gl = this.renderer.getContext()
            const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM)
            const vs = `
        attribute vec2 a_position;//vertex position
        attribute vec2 a_texCoord;//vertex texture coordinate(used to map on vertices)
        uniform mat3 displayTransform;//coordinate system transformation matrix
        varying vec2 v_texCoord;//interpolation used to pass texture coordinates between vertex shaders and fragment shaders
        void main() {
          vec3 p = displayTransform * vec3(a_position, 0);//coordinate conversion
          gl_Position = vec4(p, 1);//coordinate homogenization
          v_texCoord = a_texCoord;
        }
      `
            const fs = `
        precision highp float;//Set floating-point precision to high precision
        uniform sampler2D y_texture;//Store the texture of the Y component
        uniform sampler2D uv_texture;//The texture of the UV component is stored
        varying vec2 v_texCoord;//Texture coordinates computed in the vertex shader

        void main() {
          //obtain the color value from the Y texture using the texture coordinate v_texCoord and stored in the variable y_color
          vec4 y_color = texture2D(y_texture, v_texCoord);
          //obtain the color value from the UV texture using the texture coordinate v_texCoord and stored in the variable uv_color
          vec4 uv_color = texture2D(uv_texture, v_texCoord);

          float Y, U, V;//Y is the luminance component, and U and V are the chrominance components
          float R ,G, B;

          //Get the values of the Y, U, and V components
          Y = y_color.r;
          U = uv_color.r - 0.5;
          V = uv_color.a - 0.5;

          //according to the conversion formula from YUV to RGB, calculate the values of RGB components 
          R = Y + 1.402 * V;
          G = Y - 0.344 * U - 0.714 * V;
          B = Y + 1.772 * U;

          //set the final RGB color as the color output of the fragment
          gl_FragColor = vec4(R, G, B, 1.0);
        }   
      `
            const vertShader = gl.createShader(gl.VERTEX_SHADER)
            gl.shaderSource(vertShader, vs)
            gl.compileShader(vertShader)

            const fragShader = gl.createShader(gl.FRAGMENT_SHADER)
            gl.shaderSource(fragShader, fs)
            gl.compileShader(fragShader)

            const program = this._program = gl.createProgram()
            this._program.gl = gl
            gl.attachShader(program, vertShader)
            gl.attachShader(program, fragShader)
            gl.deleteShader(vertShader)
            gl.deleteShader(fragShader)
            gl.linkProgram(program)
            gl.useProgram(program)

            const uniformYTexture = gl.getUniformLocation(program, 'y_texture')
            gl.uniform1i(uniformYTexture, 5)
            const uniformUVTexture = gl.getUniformLocation(program, 'uv_texture')
            gl.uniform1i(uniformUVTexture, 6)

            this._dt = gl.getUniformLocation(program, 'displayTransform')
            gl.useProgram(currentProgram)
        },
        initVAO() {
            const gl = this.renderer.getContext()
            const ext = gl.getExtension('OES_vertex_array_object')//get extension functions for VAO to use
            this.ext = ext
            //create VAO object
            const vao = ext.createVertexArrayOES()
            //binding VAO to WebGL context
            ext.bindVertexArrayOES(vao)//binding VAO to WebGL context

            const currentVAO = gl.getParameter(gl.VERTEX_ARRAY_BINDING)

            //vertex position data from vertex shader
            const posAttr = gl.getAttribLocation(this._program, 'a_position')
            //create VBO object
            const pos = gl.createBuffer()
            //binding VBO to WebGL context's buffer named gl.ARRAY_BUFFER
            gl.bindBuffer(gl.ARRAY_BUFFER, pos)
            //Pass the vertex data to the VBO
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]), gl.STATIC_DRAW)
            //pointer used to configure vertex attributes
            gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0)
            //Enable the corresponding vertex attributes
            gl.enableVertexAttribArray(posAttr)
            //pass the buffer pos to VAO (for better management)
            vao.posBuffer = pos

            //vertex texture data from fragment shader
            const texcoordAttr = gl.getAttribLocation(this._program, 'a_texCoord')
            //create VBO object
            const texcoord = gl.createBuffer()
            //binding VBO to WebGL context's buffer named gl.ARRAY_BUFFER
            gl.bindBuffer(gl.ARRAY_BUFFER, texcoord)
            //Pass the texture coordinates data to the VBO
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, 0, 1, 1, 0, 0, 0]), gl.STATIC_DRAW)
            //pointer used to configure texture coordinates attributes
            gl.vertexAttribPointer(texcoordAttr, 2, gl.FLOAT, false, 0, 0)
            //Enable the corresponding texture coordinates attributes
            gl.enableVertexAttribArray(texcoordAttr)
            //pass the buffer texcoord to VAO (for better management)
            vao.texcoordBuffer = texcoord

            ext.bindVertexArrayOES(currentVAO)
            this._vao = vao
        },
        initGL() {
            this.initShader()
            this.initVAO()
        },
        renderGL(frame) {
            const gl = this.renderer.getContext()
            gl.disable(gl.DEPTH_TEST)
            const {
                yTexture,
                uvTexture
            } = frame.getCameraTexture(gl, 'yuv')
            const displayTransform = frame.getDisplayTransform()
            if (yTexture && uvTexture) {
                const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM)
                const currentActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE)
                //use the pre-define set of vertex property pointers and states
                const currentVAO = gl.getParameter(gl.VERTEX_ARRAY_BINDING)

                gl.useProgram(this._program)
                this.ext.bindVertexArrayOES(this._vao)

                gl.uniformMatrix3fv(this._dt, false, displayTransform)
                gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)

                //activate the texture unit whose texture unit index is 5
                gl.activeTexture(gl.TEXTURE0 + 5)
                //gets the texture object that currently bound to texture unit 5(save the original texture object)
                const bindingTexture5 = gl.getParameter(gl.TEXTURE_BINDING_2D)
                //binding yTexture to texture unit 5 (The texture object in texture unit 5 is yTexture)
                gl.bindTexture(gl.TEXTURE_2D, yTexture)

                //activate the texture unit whose texture unit index is 6
                gl.activeTexture(gl.TEXTURE0 + 6)
                //gets the texture object that currently bound to texture unit 6(save the original texture object)
                const bindingTexture6 = gl.getParameter(gl.TEXTURE_BINDING_2D)
                //binding uvTexture to texture unit 6 (The texture object in texture unit 6 is uvTexture)
                gl.bindTexture(gl.TEXTURE_2D, uvTexture)

                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)


                //Switch back to the original texture object
                gl.bindTexture(gl.TEXTURE_2D, bindingTexture6)
                //remember to activate the texture unit before using it(only one texture unit can be activated at a time)
                gl.activeTexture(gl.TEXTURE0 + 5)
                //Switch back to the original texture object
                gl.bindTexture(gl.TEXTURE_2D, bindingTexture5)

                gl.useProgram(currentProgram)
                gl.activeTexture(currentActiveTexture)
                this.ext.bindVertexArrayOES(currentVAO)
            }
        },
    },
})

export default yuvBehavior