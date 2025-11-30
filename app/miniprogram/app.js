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
    isCloudInit: false, // 云开发初始化状态
    isLogin: false // 登录状态
  },

  /**
   * 小程序初始化
   */
  onLaunch: function () {
    console.log('小程序启动');
    this.initCloud();
    // 云开发初始化成功后，检查登录状态
    // 注意：如果需要启动时自动跳转登录页，可以在 checkLoginStatus 后调用
    this.checkLoginStatus();
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
        // 云开发初始化成功后，检查登录状态并尝试自动登录
        this.checkLoginStatus();
        // 如果未登录，可以尝试自动登录（不强制跳转）
        if (!this.globalData.isLogin) {
          this.autoLogin().catch(err => {
            console.log('自动登录失败，用户需要手动登录');
          });
        }
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
  },

  /**
   * 检查登录状态
   * @param {boolean} autoJumpToLogin - 如果未登录是否自动跳转到登录页（默认false）
   */
  checkLoginStatus: function (autoJumpToLogin = false) {
    try {
      const token = wx.getStorageSync('token');
      const userInfo = wx.getStorageSync('userInfo');
      
      if (token && userInfo) {
        this.globalData.userInfo = userInfo;
        this.globalData.isLogin = true;
        console.log('用户已登录:', userInfo.nickname);
        return true;
      } else {
        this.globalData.userInfo = null;
        this.globalData.isLogin = false;
        
        // 如果需要自动跳转登录页
        if (autoJumpToLogin) {
          const { navigateToLogin } = require('./utils/auth.js');
          navigateToLogin();
        }
        
        return false;
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      this.globalData.isLogin = false;
      return false;
    }
  },

  /**
   * 自动登录
   * @returns {Promise} 登录结果
   */
  autoLogin: async function () {
    try {
      // 如果已经登录，直接返回
      if (this.globalData.isLogin && this.globalData.userInfo) {
        return {
          success: true,
          data: {
            userInfo: this.globalData.userInfo
          }
        };
      }

      // 检查云开发是否已初始化
      if (!this.globalData.isCloudInit) {
        throw new Error('云开发未初始化');
      }

      // 动态导入 auth 工具
      const { wxLogin } = require('./utils/auth.js');
      const loginRes = await wxLogin();

      if (loginRes.success) {
        this.globalData.userInfo = loginRes.data.userInfo;
        this.globalData.isLogin = true;
        console.log('自动登录成功:', loginRes.data.userInfo.nickname);
      } else {
        this.globalData.isLogin = false;
      }

      return loginRes;
    } catch (error) {
      console.error('自动登录失败:', error);
      this.globalData.isLogin = false;
      return {
        success: false,
        error: error.message || '自动登录失败'
      };
    }
  },

  /**
   * 退出登录
   */
  logout: function () {
    try {
      const { logout } = require('./utils/auth.js');
      logout();
      this.globalData.userInfo = null;
      this.globalData.isLogin = false;
      console.log('用户已退出登录');
      return {
        success: true
      };
    } catch (error) {
      console.error('退出登录失败:', error);
      return {
        success: false,
        error: error.message || '退出登录失败'
      };
    }
  },

  /**
   * 统一的云函数调用方法（带权限拦截）
   * @param {string} name - 云函数名称
   * @param {object} data - 调用参数
   * @param {object} options - 选项 {skipAuth: boolean, requiredPoints: number}
   * @returns {Promise} 调用结果
   */
  callCloudFunction: function (name, data = {}, options = {}) {
    return new Promise((resolve, reject) => {
      // 检查云开发是否已初始化
      if (!this.globalData.isCloudInit) {
        reject(new Error('云开发未初始化'));
        return;
      }

      // 获取本地存储的token
      const token = wx.getStorageSync('token');
      const userInfo = wx.getStorageSync('userInfo');

      // 如果需要认证且没有token，检查是否需要跳过认证
      if (!options.skipAuth && !token) {
        // 尝试自动登录
        this.autoLogin().then(loginRes => {
          if (loginRes.success) {
            // 登录成功，重新调用
            this.callCloudFunction(name, data, options).then(resolve).catch(reject);
          } else {
            // 登录失败，跳转到登录页
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            this.globalData.userInfo = null;
            this.globalData.isLogin = false;
            
            wx.redirectTo({
              url: '/pages/login/index',
              fail: () => {
                wx.showToast({
                  title: '请先登录',
                  icon: 'none'
                });
              }
            });
            
            reject(new Error('请重新登录'));
          }
        }).catch(reject);
        return;
      }

      // 构建调用参数，自动添加token
      const callData = {
        ...data
      };

      // 如果需要认证，添加token
      if (!options.skipAuth && token) {
        callData.token = token;
      }

      // 如果需要权限检查，添加所需积分
      if (options.requiredPoints !== undefined) {
        callData.requiredPoints = options.requiredPoints;
      }

      // 调用云函数
      wx.cloud.callFunction({
        name: name,
        data: callData,
        success: (res) => {
          // 检查返回结果中的错误码
          if (res.result) {
            // 处理401错误（未授权）
            if (res.result.code === 401 || res.result.errCode === 401) {
              // Token过期，清除本地存储并跳转到登录页
              wx.removeStorageSync('token');
              wx.removeStorageSync('userInfo');
              this.globalData.userInfo = null;
              this.globalData.isLogin = false;
              
              wx.redirectTo({
                url: '/pages/login/index',
                fail: () => {
                  wx.showToast({
                    title: '登录已过期，请重新登录',
                    icon: 'none'
                  });
                }
              });
              
              reject(new Error(res.result.message || '请重新登录'));
              return;
            }
            
            // 处理403错误（权限不足）
            if (res.result.code === 403 || res.result.errCode === 403) {
              wx.showToast({
                title: res.result.message || '权限不足',
                icon: 'none',
                duration: 2000
              });
              reject(new Error(res.result.message || '权限不足'));
              return;
            }
          }
          
          // 成功返回
          resolve(res.result || res);
        },
        fail: (err) => {
          console.error('云函数调用失败:', err);
          
          // 处理网络错误或其他错误
          if (err.errMsg && err.errMsg.includes('permission')) {
            // 权限错误
            wx.showToast({
              title: '权限不足',
              icon: 'none'
            });
            reject(new Error('权限不足'));
          } else {
            // 其他错误
            reject(err);
          }
        }
      });
    });
  }
});
