// app.js
// 尝试从配置文件读取云开发配置（可选）
let cloudConfig = null;
try {
  cloudConfig = require('./config/cloud.js');
} catch (e) {
  // 配置文件不存在时使用默认配置
  console.log('未找到云开发配置文件，使用默认配置');
}

App({
  /**
   * 全局数据
   */
  globalData: {
    // env 参数说明：
    //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
    //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
    //   如不填则使用默认环境（第一个创建的环境）
    //   获取方式：微信开发者工具 -> 云开发 -> 设置 -> 环境ID
    //   优先级：配置文件 > 此处配置 > 默认环境
    env: cloudConfig ? cloudConfig.CLOUD_ENV_ID : "reko-5glgo90ia081c088", // 请在此处填入你的云开发环境ID，例如: "your-env-id"
    userInfo: null,
    isCloudInit: false // 云开发初始化状态
  },

  /**
   * 小程序初始化
   */
  onLaunch: function () {
    console.log('小程序启动');
    this.initCloud();
  },

  /**
   * 初始化微信云开发
   */
  initCloud: function () {
    // 检查基础库版本
    if (!wx.cloud) {
      const errorMsg = '请使用 2.2.3 或以上的基础库以使用云能力';
      console.error(errorMsg);
      wx.showModal({
        title: '版本过低',
        content: errorMsg + '\n\n请在微信开发者工具中升级基础库版本',
        showCancel: false,
        confirmText: '我知道了'
      });
      this.globalData.isCloudInit = false;
      return;
    }

    try {
      // 获取环境ID（优先级：配置文件 > globalData > 默认）
      const envId = this.globalData.env || (cloudConfig && cloudConfig.CLOUD_ENV_ID) || undefined;
      
      // 初始化云开发
      wx.cloud.init({
        // 如果 env 为空字符串或 undefined，则使用默认环境（第一个创建的环境）
        env: envId || undefined,
        traceUser: true, // 记录用户访问
      });

      console.log('云开发初始化成功', {
        env: envId || '默认环境'
      });

      this.globalData.isCloudInit = true;

      // 延迟验证云开发环境，避免阻塞启动
      setTimeout(() => {
        this.checkCloudEnvironment();
      }, 500);
    } catch (error) {
      console.error('云开发初始化失败:', error);
      this.handleCloudInitError(error);
      this.globalData.isCloudInit = false;
    }
  },

  /**
   * 检查云开发环境是否可用
   */
  checkCloudEnvironment: function () {
    // 检查云开发是否已初始化
    if (!this.globalData.isCloudInit) {
      console.warn('云开发未初始化，跳过环境验证');
      return;
    }

    // 尝试调用云函数来验证环境是否正常
    // 注意：如果云函数不存在，这是正常的，不影响其他功能
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'checkEnv'
      },
      success: (res) => {
        console.log('云开发环境验证成功', res);
      },
      fail: (err) => {
        // 如果云函数不存在，这是正常的，不影响其他功能
        if (err.errMsg && err.errMsg.includes('FunctionName')) {
          console.warn('云函数 quickstartFunctions 不存在，这是正常的（可以稍后部署）');
        } else if (err.errMsg && err.errMsg.includes('Environment not found')) {
          console.error('云开发环境未找到');
          this.globalData.isCloudInit = false;
          this.handleCloudInitError({
            errMsg: 'Environment not found',
            message: '云开发环境未找到，请检查环境ID是否正确'
          });
        } else if (err.errMsg && err.errMsg.includes('permission')) {
          console.error('云开发权限不足');
          this.globalData.isCloudInit = false;
          this.handleCloudInitError(err);
        } else {
          // 其他错误可能是网络问题或云函数未部署，不影响基本功能
          console.warn('云开发环境验证失败（可能是云函数未部署或网络问题）:', err);
        }
      }
    });
  },

  /**
   * 处理云开发初始化错误
   */
  handleCloudInitError: function (error) {
    let title = '云开发初始化失败';
    let content = '';

    if (error.errMsg) {
      if (error.errMsg.includes('Environment not found')) {
        title = '环境未找到';
        content = '云开发环境未找到，请检查：\n\n' +
          '1. 是否已开通云开发服务\n' +
          '2. 环境ID是否正确（在 app.js 中配置）\n' +
          '3. 环境ID可在云控制台 -> 设置中查看';
      } else if (error.errMsg.includes('permission')) {
        title = '权限不足';
        content = '云开发权限不足，请检查小程序是否已开通云开发服务';
      } else {
        content = '错误信息：' + error.errMsg + '\n\n' +
          '请检查：\n' +
          '1. 是否已开通云开发服务\n' +
          '2. 网络连接是否正常\n' +
          '3. 基础库版本是否满足要求';
      }
    } else if (error.message) {
      content = error.message;
    } else {
      content = '未知错误，请稍后重试';
    }

    // 只在开发环境显示详细错误
    if (this.globalData.env) {
      wx.showModal({
        title: title,
        content: content,
        showCancel: false,
        confirmText: '我知道了',
        success: (res) => {
          if (res.confirm) {
            console.error('云开发初始化错误详情:', error);
          }
        }
      });
    } else {
      // 生产环境只记录日志，不弹窗
      console.error('云开发初始化错误:', error);
    }
  },

  /**
   * 获取云开发初始化状态
   */
  isCloudReady: function () {
    return this.globalData.isCloudInit;
  }
});
