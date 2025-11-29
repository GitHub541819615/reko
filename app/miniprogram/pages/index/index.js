// pages/index/index.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 衣物列表
    items: [
      {
        id: '1',
        name: '粉色连衣裙',
        category: '连衣裙',
        imageUrl: '/images/default-goods-image.png'
      },
      {
        id: '2',
        name: '白色衬衫',
        category: '上装',
        imageUrl: '/images/default-goods-image.png'
      },
      {
        id: '3',
        name: '蓝色牛仔裤',
        category: '下装',
        imageUrl: '/images/default-goods-image.png'
      },
      {
        id: '4',
        name: '黑色外套',
        category: '外套',
        imageUrl: '/images/default-goods-image.png'
      },
      {
        id: '5',
        name: '米色毛衣',
        category: '上装',
        imageUrl: '/images/default-goods-image.png'
      },
      {
        id: '6',
        name: '灰色半身裙',
        category: '下装',
        imageUrl: '/images/default-goods-image.png'
      }
    ],
    // 加载状态
    loading: false,
    // 空状态
    isEmpty: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadItems();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次显示页面时刷新数据
    this.loadItems();
  },

  /**
   * 加载衣物列表
   */
  async loadItems() {
    this.setData({
      loading: true
    });

    try {
      // 检查云开发是否已初始化
      const app = getApp();
      if (!app.globalData.isCloudInit) {
        throw new Error('云开发未初始化');
      }

      // 从云数据库获取衣物列表
      const db = wx.cloud.database();
      const result = await db.collection('items')
        .orderBy('createTime', 'desc')
        .get();
      
      console.log('加载衣物列表成功，共', result.data.length, '条');
      
      const items = result.data.map(item => ({
        id: item._id,
        name: item.name,
        category: item.category,
        imageUrl: item.imageUrl || '/images/default-goods-image.png',
        price: item.price || '0.00'
      }));
      
      this.setData({
        items: items,
        loading: false,
        isEmpty: items.length === 0
      });
    } catch (error) {
      console.error('加载衣物列表失败:', error);
      console.error('错误详情:', {
        errMsg: error.errMsg,
        errCode: error.errCode,
        message: error.message
      });
      // 如果出错，使用示例数据
      const mockItems = [
        {
          id: '1',
          name: '粉色连衣裙',
          category: '连衣裙',
          imageUrl: '/images/default-goods-image.png'
        },
        {
          id: '2',
          name: '白色衬衫',
          category: '上装',
          imageUrl: '/images/default-goods-image.png'
        }
      ];
      
      this.setData({
        items: mockItems,
        loading: false,
        isEmpty: mockItems.length === 0
      });
      
      wx.showToast({
        title: '加载失败，显示示例数据',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 跳转到添加衣物页面
   */
  goToAddItem() {
    wx.navigateTo({
      url: '/pages/add-item/index'
    });
  },

  /**
   * 查看衣物详情
   */
  viewItemDetail(e) {
    const { id } = e.currentTarget.dataset;
    // TODO: 跳转到详情页
    console.log('查看衣物详情:', id);
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadItems();
    wx.stopPullDownRefresh();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    // TODO: 加载更多数据
  }
});
