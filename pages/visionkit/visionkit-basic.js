import getBehavior from './behavior'
import yuvBehavior from './yuvBehavior'

const NEAR = 0.001
const FAR = 1000

Component({
    behaviors: [getBehavior(), yuvBehavior],
    data: {
      theme: 'light',
    },
    lifetimes: {
        /**
        * 生命周期函数--监听页面加载
        */
       //Triggered when removed from the page stack
        detached() {
        console.log("页面detached")
        if (wx.offThemeChange) {
          wx.offThemeChange()
        }
        },
        //Trigger when the page is ready
        ready() {
        console.log("页面准备完全")
          this.setData({
            theme: wx.getSystemInfoSync().theme || 'light'
          })
  
          if (wx.onThemeChange) {
            wx.onThemeChange(({theme}) => {
              this.setData({theme})
            })
          }
        },
    },
    methods: {
        init() {
            this.initGL()
        },
        render(frame) {
            this.renderGL(frame)

            const camera = frame.camera

            const dt = this.clock.getDelta()
            if (this.mixers) {
                this.mixers.forEach(mixer => mixer.update(dt))
            }
            
            // 相机
            if (camera) {
                this.camera.matrixAutoUpdate = false
                //viewMatrix: the view matrix of the camera, which describes the transformation from the world coordinate system to the camera coordinate system
                this.camera.matrixWorldInverse.fromArray(camera.viewMatrix)
                //transformation from the camera coordinate system to the world coordinate system
                this.camera.matrixWorld.getInverse(this.camera.matrixWorldInverse)

                //Obtaining the projection matrix. NEAR and FAR are the proximal and distal clipping planes of the projection matrix.
                const projectionMatrix = camera.getProjectionMatrix(NEAR, FAR)
                //update the camera projection matrix
                this.camera.projectionMatrix.fromArray(projectionMatrix)
                //Update the inverse of the camera projection matrix
                this.camera.projectionMatrixInverse.getInverse(this.camera.projectionMatrix)
            }

            this.renderer.autoClearColor = false
            this.renderer.render(this.scene, this.camera)
            this.renderer.state.setCullFace(this.THREE.CullFaceNone)
        },
    },
})