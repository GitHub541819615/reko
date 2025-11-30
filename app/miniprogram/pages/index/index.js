// pages/index/index.js
import { dbQuery, showError } from '../../utils/request.js';
import { requireLogin, navigateToLogin, checkLoginStatus } from '../../utils/auth.js';

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 衣物列表
    closetItems: [],
    filteredItems: [], // 筛选后的衣物列表
    // 加载状态
    loading: false,
    // 空状态
    isEmpty: false,
    // 标签筛选
    allTags: [], // 所有可用标签
    selectedFilterTags: [], // 选中的筛选标签
    // 多选模式
    selectionMode: false, // 是否处于多选模式
    selectedItemIds: [], // 选中的衣物ID列表
    // 数据洞察
    insights: {
      totalCount: 0, // 衣物总数
      categoryStats: [], // 分类统计 [{category: '上装', count: 3, percentage: 15}]
      shoppingSuggestions: [] // 购物建议
    },
    // 菜单状态
    showMenu: false, // 是否显示操作菜单
    currentItemId: '' // 当前操作的衣物ID
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
      
      const items = result.data.map(item => {
        // 兼容新旧数据格式：如果有 tags 使用 tags，否则从 category 生成 tags
        let tags = item.tags || [];
        if (!tags.length && item.category) {
          tags = [`品类:${item.category}`];
        }
        
        return {
          id: item._id,
          name: item.name,
          category: item.category || '', // 保留 category 以兼容旧代码
          tags: tags, // 新增 tags 数组
          imageUrl: item.imageUrl || '/images/default-goods-image.png',
          price: item.price || '0.00'
        };
      });
      
      // 计算数据洞察
      const insights = this.calculateInsights(items);
      
      // 提取所有标签
      const allTags = this.extractAllTags(items);
      
      this.setData({
        closetItems: items,
        filteredItems: items, // 初始显示所有物品
        allTags: allTags,
        loading: false,
        isEmpty: items.length === 0,
        insights: insights
      });
    } catch (error) {
      console.error('加载衣物列表失败:', error);
      console.error('错误详情:', {
        errMsg: error.errMsg,
        errCode: error.errCode,
        message: error.message
      });
      // 如果出错，显示空状态，不显示 mock 数据
      const insights = this.calculateInsights([]);
      
      this.setData({
        closetItems: [],
        filteredItems: [],
        allTags: [],
        loading: false,
        isEmpty: true,
        insights: insights
      });
      
      wx.showToast({
        title: '加载失败，请检查网络',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 跳转到添加衣物页面
   */
  goToAddItem() {
    // 检查登录状态，未登录则跳转到登录页
    requireLogin(() => {
      wx.navigateTo({
        url: '/pages/add-item/index'
      });
    });
  },

  /**
   * 跳转到穿搭灵感
   */
  goToInspiration() {
    wx.navigateTo({
      url: '/pages/inspiration/index'
    });
  },

  /**
   * 跳转到搭配列表
   */
  goToOutfits() {
    wx.navigateTo({
      url: '/pages/outfits/index'
    });
  },

  /**
   * 计算数据洞察
   */
  calculateInsights(items) {
    const totalCount = items.length;
    
    if (totalCount === 0) {
      return {
        totalCount: 0,
        categoryStats: [],
        shoppingSuggestions: []
      };
    }
    
    // 统计各分类数量
    const categoryMap = {};
    items.forEach(item => {
      const category = item.category || '其他';
      categoryMap[category] = (categoryMap[category] || 0) + 1;
    });
    
    // 转换为数组并计算百分比
    const categoryStats = Object.keys(categoryMap).map(category => ({
      category: category,
      count: categoryMap[category],
      percentage: Math.round((categoryMap[category] / totalCount) * 100)
    })).sort((a, b) => b.count - a.count); // 按数量降序排列
    
    // 生成购物建议
    const shoppingSuggestions = this.generateShoppingSuggestions(categoryStats, totalCount);
    
    return {
      totalCount: totalCount,
      categoryStats: categoryStats,
      shoppingSuggestions: shoppingSuggestions
    };
  },

  /**
   * 生成购物建议
   */
  generateShoppingSuggestions(categoryStats, totalCount) {
    const suggestions = [];
    
    // 定义标准分类和推荐数量阈值
    const standardCategories = {
      '上装': { min: 5, ideal: 10 },
      '下装': { min: 3, ideal: 6 },
      '外套': { min: 2, ideal: 4 },
      '连衣裙': { min: 2, ideal: 5 },
      '配饰': { min: 3, ideal: 8 },
      '鞋履': { min: 2, ideal: 5 }
    };
    
    // 检查每个标准分类
    Object.keys(standardCategories).forEach(category => {
      const standard = standardCategories[category];
      const stat = categoryStats.find(s => s.category === category);
      const count = stat ? stat.count : 0;
      const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      
      if (count < standard.min) {
        suggestions.push({
          category: category,
          count: count,
          percentage: percentage,
          message: `您的「${category}」仅有${count}件，占比${percentage}%，可以考虑补充了。`,
          priority: 'high'
        });
      } else if (count < standard.ideal && percentage < 20) {
        suggestions.push({
          category: category,
          count: count,
          percentage: percentage,
          message: `您的「${category}」有${count}件，占比${percentage}%，可以适当增加。`,
          priority: 'medium'
        });
      }
    });
    
    // 如果某个分类占比过高（>40%），建议平衡
    categoryStats.forEach(stat => {
      if (stat.percentage > 40 && totalCount > 5) {
        suggestions.push({
          category: stat.category,
          count: stat.count,
          percentage: stat.percentage,
          message: `您的「${stat.category}」占比${stat.percentage}%，建议增加其他分类的衣物以平衡衣橱。`,
          priority: 'low'
        });
      }
    });
    
    // 按优先级排序
    const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    // 最多返回3条建议
    return suggestions.slice(0, 3);
  },

  /**
   * 提取所有标签
   */
  extractAllTags(items) {
    const tagSet = new Set();
    items.forEach(item => {
      if (item.tags && item.tags.length > 0) {
        item.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  },

  /**
   * 切换筛选标签
   */
  toggleFilterTag(e) {
    const { tag } = e.currentTarget.dataset;
    const { selectedFilterTags } = this.data;
    const index = selectedFilterTags.indexOf(tag);
    
    if (index !== -1) {
      // 取消选中
      selectedFilterTags.splice(index, 1);
    } else {
      // 选中
      selectedFilterTags.push(tag);
    }
    
    this.setData({
      selectedFilterTags: selectedFilterTags
    });
    
    // 应用筛选
    this.applyFilters();
  },

  /**
   * 清除筛选
   */
  clearFilters() {
    this.setData({
      selectedFilterTags: [],
      filteredItems: this.data.closetItems
    });
  },

  /**
   * 应用筛选
   */
  applyFilters() {
    const { closetItems, selectedFilterTags } = this.data;
    
    if (selectedFilterTags.length === 0) {
      // 没有筛选条件，显示所有
      this.setData({
        filteredItems: closetItems
      });
      return;
    }
    
    // 筛选：物品必须包含所有选中的标签
    const filteredItems = closetItems.filter(item => {
      if (!item.tags || item.tags.length === 0) {
        return false;
      }
      // 检查是否包含所有选中的标签
      return selectedFilterTags.every(tag => item.tags.indexOf(tag) !== -1);
    });
    
    this.setData({
      filteredItems: filteredItems
    });
  },

  /**
   * 查看衣物详情（跳转到编辑页面）
   */
  viewItemDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/item-edit/index?id=${id}`
    });
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
  },

  /**
   * 图片加载错误处理
   */
  onImageError(e) {
    const { index } = e.currentTarget.dataset;
    const { filteredItems } = this.data;
    if (filteredItems && filteredItems[index]) {
      filteredItems[index].imageUrl = '/images/default-goods-image.png';
      this.setData({
        filteredItems: filteredItems
      });
    }
  },

  /**
   * 显示操作菜单
   */
  showItemMenu(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({
      showMenu: true,
      currentItemId: id
    });
  },

  /**
   * 隐藏操作菜单
   */
  hideItemMenu() {
    this.setData({
      showMenu: false,
      currentItemId: ''
    });
  },

  /**
   * 处理菜单操作
   */
  handleMenuAction(e) {
    const { action } = e.currentTarget.dataset;
    const { currentItemId } = this.data;
    
    this.hideItemMenu();
    
    if (action === 'edit') {
      // 跳转到编辑页面
      wx.navigateTo({
        url: `/pages/item-edit/index?id=${currentItemId}`
      });
    } else if (action === 'delete') {
      // 删除衣物
      this.deleteItem(currentItemId);
    }
  },

  /**
   * 删除衣物
   */
  async deleteItem(itemId) {
    // 检查登录状态
    if (!checkLoginStatus()) {
      navigateToLogin('/pages/index/index');
      return;
    }

    // 先检查该衣物是否被用于搭配中
    const relatedOutfits = await this.checkRelatedOutfits(itemId);
    
    let deleteMode = 'itemOnly'; // 'itemOnly' 或 'itemAndOutfits'
    
    if (relatedOutfits.length > 0) {
      // 有相关搭配，询问用户如何处理
      const result = await this.showDeleteConfirmWithOutfits(relatedOutfits.length);
      if (!result.confirm) {
        return; // 用户取消删除
      }
      deleteMode = result.deleteOutfits ? 'itemAndOutfits' : 'itemOnly';
    } else {
      // 没有相关搭配，直接确认删除
      const result = await this.showDeleteConfirm();
      if (!result.confirm) {
        return; // 用户取消删除
      }
    }

    // 显示加载状态
    wx.showLoading({
      title: '删除中...',
      mask: true
    });

    try {
      const db = wx.cloud.database();
      
      // 删除衣物
      await db.collection('items').doc(itemId).remove();
      
      // 如果选择删除相关搭配，也删除这些搭配
      if (deleteMode === 'itemAndOutfits' && relatedOutfits.length > 0) {
        const batch = db.batch();
        relatedOutfits.forEach(outfit => {
          const outfitRef = db.collection('outfits').doc(outfit._id);
          batch.delete(outfitRef);
        });
        await batch.commit();
      } else if (deleteMode === 'itemOnly' && relatedOutfits.length > 0) {
        // 只删除衣物，但需要从搭配中移除该衣物的引用
        const batch = db.batch();
        relatedOutfits.forEach(outfit => {
          const outfitRef = db.collection('outfits').doc(outfit._id);
          // 从搭配的 items 数组中移除该衣物
          const updatedItems = outfit.items.filter(item => item.itemId !== itemId);
          batch.update(outfitRef, {
            data: {
              items: updatedItems,
              updateTime: db.serverDate()
            }
          });
        });
        await batch.commit();
      }

      wx.hideLoading();
      wx.showToast({
        title: '删除成功',
        icon: 'success',
        duration: 1500
      });

      // 刷新列表
      setTimeout(() => {
        this.loadItems();
      }, 1500);
    } catch (error) {
      console.error('删除失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '删除失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 检查该衣物是否被用于搭配中
   */
  async checkRelatedOutfits(itemId) {
    try {
      const db = wx.cloud.database();
      // 获取所有搭配，然后在代码中筛选
      const result = await db.collection('outfits').get();
      
      // 筛选包含该衣物的搭配
      const relatedOutfits = result.data.filter(outfit => {
        if (!outfit.items || !Array.isArray(outfit.items)) {
          return false;
        }
        return outfit.items.some(item => item.itemId === itemId);
      });
      
      return relatedOutfits;
    } catch (error) {
      console.error('检查搭配关联失败:', error);
      return [];
    }
  },

  /**
   * 显示删除确认对话框（无相关搭配）
   */
  showDeleteConfirm() {
    return new Promise((resolve) => {
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这件衣物吗？此操作不可撤销。',
        confirmColor: '#FF4D4F',
        success: (res) => {
          resolve({ confirm: res.confirm });
        },
        fail: () => {
          resolve({ confirm: false });
        }
      });
    });
  },

  /**
   * 显示删除确认对话框（有相关搭配）
   */
  showDeleteConfirmWithOutfits(outfitCount) {
    return new Promise((resolve) => {
      wx.showModal({
        title: '确认删除',
        content: `该衣物已被用于 ${outfitCount} 个搭配中。删除后这些搭配也会受到影响。\n\n请选择删除方式：`,
        confirmText: '删除衣物及相关搭配',
        cancelText: '仅删除衣物',
        confirmColor: '#FF4D4F',
        success: (res) => {
          if (res.confirm) {
            // 用户选择删除衣物及相关搭配
            wx.showModal({
              title: '最终确认',
              content: `确定要删除这件衣物及其 ${outfitCount} 个相关搭配吗？此操作不可撤销。`,
              confirmColor: '#FF4D4F',
              success: (confirmRes) => {
                resolve({
                  confirm: confirmRes.confirm,
                  deleteOutfits: confirmRes.confirm
                });
              },
              fail: () => {
                resolve({ confirm: false, deleteOutfits: false });
              }
            });
          } else {
            // 用户选择仅删除衣物
            wx.showModal({
              title: '最终确认',
              content: '确定要删除这件衣物吗？该衣物将从相关搭配中移除，但搭配本身会保留。此操作不可撤销。',
              confirmColor: '#FF4D4F',
              success: (confirmRes) => {
                resolve({
                  confirm: confirmRes.confirm,
                  deleteOutfits: false
                });
              },
              fail: () => {
                resolve({ confirm: false, deleteOutfits: false });
              }
            });
          }
        },
        fail: () => {
          resolve({ confirm: false, deleteOutfits: false });
        }
      });
    });
  }
});
