import React, { useState, useEffect } from 'react';
import { Plus, FileText, Download, Search, Calendar, User, Star, Edit2, Trash2 } from 'lucide-react';
import { LocalStorage, STORAGE_KEYS } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../services/api';
import SocketService from '../services/socket';
import './ServiceMaterials.css';

interface ServiceMaterial {
  id: number;
  title: string;
  description: string;
  category: 'proposal' | 'contract' | 'manual' | 'template' | 'presentation' | 'other';
  serviceCategory?: 'advertising' | 'lp' | 'design' | 'video' | 'development' | 'consulting' | 'other';
  fileType: 'pdf' | 'doc' | 'ppt' | 'xls' | 'image' | 'other';
  fileSize: string;
  uploadDate: string;
  uploadedBy: string;
  tags: string[];
  downloadCount: number;
  isPublic: boolean;
  version: string;
  notes: string;
  createdAt: string;
  fileData?: string;
  fileName?: string;
  price?: number;
  deliveryTime?: string;
}

const ServiceMaterials: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [materials, setMaterials] = useState<ServiceMaterial[]>([]);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<ServiceMaterial | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<ServiceMaterial | null>(null);
  const [newMaterial, setNewMaterial] = useState<Partial<ServiceMaterial>>({
    category: 'proposal',
    serviceCategory: 'other',
    fileType: 'pdf',
    isPublic: true,
    version: '1.0',
    downloadCount: 0,
    tags: [],
    createdAt: new Date().toISOString()
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterFileType, setFilterFileType] = useState('all');
  const [filterServiceCategory, setFilterServiceCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // データをサーバーから取得（サーバー優先）
  const loadDataFromServer = async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await ApiService.getData(STORAGE_KEYS.SERVICE_MATERIALS);
      // チームメンバー追加と同じパターン：サーバーのデータを常に適用（空配列でも）
      if (response.data && Array.isArray(response.data)) {
        console.log('サーバーからのサービス資料データを適用:', response.data.length, '件');
        setMaterials(response.data);
        LocalStorage.set(STORAGE_KEYS.SERVICE_MATERIALS, response.data);
      } else {
        // サーバーにデータがない場合のみ、LocalStorageから読み込み
        const savedMaterials = LocalStorage.get<ServiceMaterial[]>(STORAGE_KEYS.SERVICE_MATERIALS);
        if (savedMaterials && savedMaterials.length > 0) {
          setMaterials(savedMaterials);
        }
      }
    } catch (error) {
      console.error('サーバーからのデータ取得エラー:', error);
      // エラー時はローカルストレージから読み込み
      const savedMaterials = LocalStorage.get<ServiceMaterial[]>(STORAGE_KEYS.SERVICE_MATERIALS);
      if (savedMaterials && savedMaterials.length > 0) {
        setMaterials(savedMaterials);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // データをサーバーに保存
  const saveDataToServer = async (dataType: string, data: any) => {
    if (!isAuthenticated) {
      console.warn('認証されていないため、サーバーへの保存をスキップ');
      return;
    }
    
    try {
      console.log('サーバーへの保存を開始:', dataType, data.length || 'N/A', '件');
      await ApiService.saveData(dataType, data);
      console.log('サーバーへの保存が成功しました:', dataType);
      
      // Socket.ioで他のクライアントに通知
      if (user?.teamId) {
        SocketService.sendDataUpdate(user.teamId, dataType, data, user.id);
      }
    } catch (error: any) {
      console.error('サーバーへのデータ保存エラー:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.teamId) {
      // サーバーから取得（優先）
      loadDataFromServer().catch(() => {
        // サーバーから取得失敗時はLocalStorageから読み込み
        console.log('サーバーからのデータ取得に失敗したため、LocalStorageから読み込みます');
        const savedMaterials = LocalStorage.get<ServiceMaterial[]>(STORAGE_KEYS.SERVICE_MATERIALS);
        if (savedMaterials && savedMaterials.length > 0) {
          setMaterials(savedMaterials);
        }
        setIsLoading(false);
      });
      
      // Socket.io接続
      SocketService.connect(user.teamId);
      
      // リアルタイム更新のリスナーを設定（他のユーザーの変更のみ適用）
      const handleDataUpdate = (data: any) => {
        console.log('Real-time data update received:', data);
        const { dataType, data: newData, userId } = data;
        
        // 現在のユーザー自身の変更は無視（LocalStorage優先）
        if (userId === user?.id) {
          console.log('Ignoring own update from user:', userId);
          return;
        }
        
        console.log('Applying update from user:', userId, 'dataType:', dataType);
        
        if (dataType === STORAGE_KEYS.SERVICE_MATERIALS) {
          setMaterials(newData);
          LocalStorage.set(STORAGE_KEYS.SERVICE_MATERIALS, newData);
        }
      };
      
      SocketService.on('dataUpdated', handleDataUpdate);
      
      return () => {
        SocketService.off('dataUpdated', handleDataUpdate);
      };
    } else {
      // 非認証時はローカルストレージから読み込み
      const savedMaterials = LocalStorage.get<ServiceMaterial[]>(STORAGE_KEYS.SERVICE_MATERIALS);
      if (savedMaterials && savedMaterials.length > 0) {
        setMaterials(savedMaterials);
      }
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.teamId, user?.id]);


  const addMaterial = async () => {
    if (newMaterial.title && newMaterial.description) {
      let updatedMaterials;
      
      if (editingMaterial) {
        // 編集モード
        updatedMaterials = materials.map(m => 
          m.id === editingMaterial.id 
            ? {
                ...editingMaterial,
                title: newMaterial.title,
                description: newMaterial.description,
                category: newMaterial.category as ServiceMaterial['category'],
                serviceCategory: newMaterial.serviceCategory as ServiceMaterial['serviceCategory'],
                fileType: newMaterial.fileType as ServiceMaterial['fileType'],
                fileSize: newMaterial.fileSize || editingMaterial.fileSize,
                uploadDate: editingMaterial.uploadDate,
                uploadedBy: newMaterial.uploadedBy || editingMaterial.uploadedBy,
                tags: newMaterial.tags || [],
                downloadCount: editingMaterial.downloadCount,
                isPublic: newMaterial.isPublic || true,
                version: newMaterial.version || editingMaterial.version,
                notes: newMaterial.notes || '',
                createdAt: editingMaterial.createdAt,
                // ファイルデータは保存しない（LocalStorageのサイズ制限回避）
                fileData: undefined,
                fileName: newMaterial.fileName || editingMaterial.fileName,
                price: newMaterial.price,
                deliveryTime: newMaterial.deliveryTime
              }
            : m
        );
        setEditingMaterial(null);
      } else {
        // 新規追加モード
        const material: ServiceMaterial = {
          id: Date.now(),
          title: newMaterial.title,
          description: newMaterial.description,
          category: newMaterial.category as ServiceMaterial['category'],
          serviceCategory: newMaterial.serviceCategory as ServiceMaterial['serviceCategory'],
          fileType: newMaterial.fileType as ServiceMaterial['fileType'],
          fileSize: newMaterial.fileSize || '0 KB',
          uploadDate: new Date().toISOString().split('T')[0],
          uploadedBy: newMaterial.uploadedBy || '',
          tags: newMaterial.tags || [],
          downloadCount: newMaterial.downloadCount || 0,
          isPublic: newMaterial.isPublic || true,
          version: newMaterial.version || '1.0',
          notes: newMaterial.notes || '',
          createdAt: new Date().toISOString(),
          // ファイルデータは保存しない（LocalStorageのサイズ制限回避）
          fileData: undefined,
          fileName: newMaterial.fileName,
          price: newMaterial.price,
          deliveryTime: newMaterial.deliveryTime
        };
        updatedMaterials = [...materials, material];
      }
      
      console.log('資料を保存:', updatedMaterials.length, '件');
      setMaterials(updatedMaterials);
      LocalStorage.set(STORAGE_KEYS.SERVICE_MATERIALS, updatedMaterials);
      
      // サーバーに保存
      try {
        await saveDataToServer(STORAGE_KEYS.SERVICE_MATERIALS, updatedMaterials);
      } catch (error) {
        console.error('サービス資料の保存に失敗しましたが、LocalStorageには保存済みです');
      }
    }
    
    setNewMaterial({
      category: 'proposal',
      serviceCategory: 'other',
      fileType: 'pdf',
      isPublic: true,
      version: '1.0',
      downloadCount: 0,
      tags: [],
      createdAt: new Date().toISOString()
    });
    setShowMaterialModal(false);
  };

  const addTag = () => {
    const tag = prompt('タグを入力してください:');
    if (tag) {
      setNewMaterial({
        ...newMaterial,
        tags: [...(newMaterial.tags || []), tag]
      });
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewMaterial({
      ...newMaterial,
      tags: newMaterial.tags?.filter(tag => tag !== tagToRemove) || []
    });
  };

  const editMaterial = (material: ServiceMaterial) => {
    setEditingMaterial(material);
    setNewMaterial({
      title: material.title,
      description: material.description,
      category: material.category,
      serviceCategory: material.serviceCategory,
      fileType: material.fileType,
      fileSize: material.fileSize,
      uploadedBy: material.uploadedBy,
      tags: material.tags,
      isPublic: material.isPublic,
      version: material.version,
      notes: material.notes,
      fileData: material.fileData,
      fileName: material.fileName,
      price: material.price,
      deliveryTime: material.deliveryTime
    });
    setShowMaterialModal(true);
  };

  const deleteMaterial = async (materialId: number) => {
    const material = materials.find(m => m.id === materialId);
    if (material && window.confirm(`「${material.title}」を削除してもよろしいですか？`)) {
      const updatedMaterials = materials.filter(m => m.id !== materialId);
      console.log('資料を保存:', updatedMaterials.length, '件');
      setMaterials(updatedMaterials);
      LocalStorage.set(STORAGE_KEYS.SERVICE_MATERIALS, updatedMaterials);
      
      // サーバーに保存
      try {
        await saveDataToServer(STORAGE_KEYS.SERVICE_MATERIALS, updatedMaterials);
      } catch (error) {
        console.error('サービス資料の削除に失敗しましたが、LocalStorageには保存済みです');
      }
    }
  };

  const downloadMaterial = async (material: ServiceMaterial) => {
    const updatedMaterials = materials.map(m => 
      m.id === material.id ? { ...m, downloadCount: m.downloadCount + 1 } : m
    );
    setMaterials(updatedMaterials);
    LocalStorage.set(STORAGE_KEYS.SERVICE_MATERIALS, updatedMaterials);
    
    // サーバーに保存
    try {
      await saveDataToServer(STORAGE_KEYS.SERVICE_MATERIALS, updatedMaterials);
    } catch (error) {
      console.error('ダウンロード数の更新に失敗しましたが、LocalStorageには保存済みです');
    }
    
    if (material.fileData) {
      const link = document.createElement('a');
      link.href = material.fileData;
      link.download = material.fileName || `${material.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };


  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'proposal': return '#4CAF50';
      case 'contract': return '#2196F3';
      case 'manual': return '#FF9800';
      case 'template': return '#9C27B0';
      case 'presentation': return '#FF5722';
      case 'other': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf': return '📄';
      case 'doc': return '📝';
      case 'ppt': return '📊';
      case 'xls': return '📈';
      case 'image': return '🖼️';
      default: return '📁';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'proposal': return '提案書';
      case 'contract': return '契約書';
      case 'manual': return 'マニュアル';
      case 'template': return 'テンプレート';
      case 'presentation': return 'プレゼン資料';
      case 'other': return 'その他';
      default: return category;
    }
  };

  const getServiceCategoryLabel = (category?: string) => {
    switch (category) {
      case 'advertising': return '広告運用';
      case 'lp': return 'LP制作';
      case 'design': return 'デザイン';
      case 'video': return '動画編集';
      case 'development': return '開発';
      case 'consulting': return 'コンサルティング';
      case 'other': return 'その他';
      default: return 'その他';
    }
  };

  const getServiceCategoryColor = (category?: string) => {
    switch (category) {
      case 'advertising': return '#FF6B6B';
      case 'lp': return '#4ECDC4';
      case 'design': return '#45B7D1';
      case 'video': return '#96CEB4';
      case 'development': return '#6C5CE7';
      case 'consulting': return '#FDA7DF';
      case 'other': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          material.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          material.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'all' || material.category === filterCategory;
    const matchesFileType = filterFileType === 'all' || material.fileType === filterFileType;
    const matchesServiceCategory = filterServiceCategory === 'all' || material.serviceCategory === filterServiceCategory;
    return matchesSearch && matchesCategory && matchesFileType && matchesServiceCategory;
  });

  return (
    <div className="service-materials">
      <div className="materials-header">
        <h1>📚 サービス資料共有</h1>
        <p className="materials-subtitle">チームで共有できるサービス資料の管理</p>
        <div className="header-actions">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="資料を検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">すべてのカテゴリ</option>
            <option value="proposal">提案書</option>
            <option value="contract">契約書</option>
            <option value="manual">マニュアル</option>
            <option value="template">テンプレート</option>
            <option value="presentation">プレゼン資料</option>
            <option value="other">その他</option>
          </select>
          <select
            className="filter-select"
            value={filterFileType}
            onChange={(e) => setFilterFileType(e.target.value)}
          >
            <option value="all">すべてのファイル形式</option>
            <option value="pdf">PDF</option>
            <option value="doc">Word</option>
            <option value="ppt">PowerPoint</option>
            <option value="xls">Excel</option>
            <option value="image">画像</option>
            <option value="other">その他</option>
          </select>
          <select
            className="filter-select"
            value={filterServiceCategory}
            onChange={(e) => setFilterServiceCategory(e.target.value)}
          >
            <option value="all">すべてのサービス</option>
            <option value="advertising">広告運用</option>
            <option value="lp">LP制作</option>
            <option value="design">デザイン</option>
            <option value="video">動画編集</option>
            <option value="development">開発</option>
            <option value="consulting">コンサルティング</option>
            <option value="other">その他</option>
          </select>
          <button className="add-material-btn" onClick={() => setShowMaterialModal(true)}>
            <Plus size={20} />
            資料追加
          </button>
        </div>
      </div>

      <div className="materials-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={24} color="#4CAF50" />
          </div>
          <div className="stat-content">
            <p className="stat-label">総資料数</p>
            <p className="stat-value">{materials.length}件</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Download size={24} color="#2196F3" />
          </div>
          <div className="stat-content">
            <p className="stat-label">総ダウンロード数</p>
            <p className="stat-value">{materials.reduce((sum, m) => sum + m.downloadCount, 0)}回</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Star size={24} color="#FF9800" />
          </div>
          <div className="stat-content">
            <p className="stat-label">公開資料</p>
            <p className="stat-value">{materials.filter(m => m.isPublic).length}件</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Calendar size={24} color="#9C27B0" />
          </div>
          <div className="stat-content">
            <p className="stat-label">今月追加</p>
            <p className="stat-value">{materials.filter(m => {
              const uploadDate = new Date(m.uploadDate);
              const now = new Date();
              return uploadDate.getMonth() === now.getMonth() && uploadDate.getFullYear() === now.getFullYear();
            }).length}件</p>
          </div>
        </div>
      </div>

      {materials.length === 0 && (
        <div className="no-materials">
          <h3>資料がありません</h3>
          <p>「資料追加」ボタンからサービス資料を追加してください</p>
        </div>
      )}

      <div className="materials-grid">
        {filteredMaterials.map(material => (
          <div key={material.id} className="material-card">
            <div className="material-header">
              <div className="material-icon">
                {getFileTypeIcon(material.fileType)}
              </div>
              <div className="material-info">
                <h3>{material.title}</h3>
                <div className="material-badges">
                  <span className="category-badge" style={{ backgroundColor: getCategoryColor(material.category) }}>
                    {getCategoryLabel(material.category)}
                  </span>
                  {material.serviceCategory && (
                    <span className="service-category-badge" style={{ backgroundColor: getServiceCategoryColor(material.serviceCategory) }}>
                      {getServiceCategoryLabel(material.serviceCategory)}
                    </span>
                  )}
                  {material.isPublic && <span className="public-badge">公開</span>}
                </div>
              </div>
            </div>
            
            <div className="material-description">
              <p>{material.description}</p>
            </div>

            <div className="material-meta">
              <div className="meta-item">
                <User size={14} />
                <span>{material.uploadedBy}</span>
              </div>
              <div className="meta-item">
                <Calendar size={14} />
                <span>{material.uploadDate}</span>
              </div>
              <div className="meta-item">
                <Download size={14} />
                <span>{material.downloadCount}回</span>
              </div>
              <div className="meta-item">
                <span>v{material.version}</span>
              </div>
            </div>

            {(material.price || material.deliveryTime) && (
              <div className="material-service-info">
                {material.price && (
                  <div className="service-info-item">
                    <span className="info-label">参考価格:</span>
                    <span className="info-value">¥{material.price.toLocaleString()}</span>
                  </div>
                )}
                {material.deliveryTime && (
                  <div className="service-info-item">
                    <span className="info-label">納期:</span>
                    <span className="info-value">{material.deliveryTime}</span>
                  </div>
                )}
              </div>
            )}

            {material.tags.length > 0 && (
              <div className="material-tags">
                {material.tags.map(tag => (
                  <span key={tag} className="tag">#{tag}</span>
                ))}
              </div>
            )}

            <div className="material-actions">
              <button 
                className="view-btn"
                onClick={() => setSelectedMaterial(material)}
              >
                <FileText size={16} />
                詳細
              </button>
              <button 
                className="edit-btn"
                onClick={() => editMaterial(material)}
                title="編集"
              >
                <Edit2 size={16} />
              </button>
              <button 
                className="delete-btn"
                onClick={() => deleteMaterial(material.id)}
                title="削除"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showMaterialModal && (
        <div className="modal-overlay" onClick={() => {
          setShowMaterialModal(false);
          setEditingMaterial(null);
          setNewMaterial({
            category: 'proposal',
            serviceCategory: 'other',
            fileType: 'pdf',
            isPublic: true,
            version: '1.0',
            downloadCount: 0,
            tags: [],
            createdAt: new Date().toISOString()
          });
        }}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingMaterial ? 'サービス資料編集' : 'サービス資料追加'}</h2>
            <div className="form-group">
              <label>資料名 *</label>
              <input
                type="text"
                value={newMaterial.title || ''}
                onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                placeholder="Webサイト制作提案書"
              />
            </div>
            <div className="form-group">
              <label>説明 *</label>
              <textarea
                value={newMaterial.description || ''}
                onChange={(e) => setNewMaterial({ ...newMaterial, description: e.target.value })}
                rows={3}
                placeholder="資料の詳細説明"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>カテゴリ</label>
                <select
                  value={newMaterial.category}
                  onChange={(e) => setNewMaterial({ ...newMaterial, category: e.target.value as ServiceMaterial['category'] })}
                >
                  <option value="proposal">提案書</option>
                  <option value="contract">契約書</option>
                  <option value="manual">マニュアル</option>
                  <option value="template">テンプレート</option>
                  <option value="presentation">プレゼン資料</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div className="form-group">
                <label>サービスカテゴリー</label>
                <select
                  value={newMaterial.serviceCategory || 'other'}
                  onChange={(e) => setNewMaterial({ ...newMaterial, serviceCategory: e.target.value as ServiceMaterial['serviceCategory'] })}
                >
                  <option value="advertising">広告運用</option>
                  <option value="lp">LP制作</option>
                  <option value="design">デザイン</option>
                  <option value="video">動画編集</option>
                  <option value="development">開発</option>
                  <option value="consulting">コンサルティング</option>
                  <option value="other">その他</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>ファイル形式</label>
                <select
                  value={newMaterial.fileType}
                  onChange={(e) => setNewMaterial({ ...newMaterial, fileType: e.target.value as ServiceMaterial['fileType'] })}
                >
                  <option value="pdf">PDF</option>
                  <option value="doc">Word</option>
                  <option value="ppt">PowerPoint</option>
                  <option value="xls">Excel</option>
                  <option value="image">画像</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div className="form-group">
                <label>バージョン</label>
                <input
                  type="text"
                  value={newMaterial.version || ''}
                  onChange={(e) => setNewMaterial({ ...newMaterial, version: e.target.value })}
                  placeholder="1.0"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>参考価格（オプション）</label>
                <input
                  type="number"
                  value={newMaterial.price || ''}
                  onChange={(e) => setNewMaterial({ ...newMaterial, price: parseInt(e.target.value) || undefined })}
                  placeholder="500000"
                />
              </div>
              <div className="form-group">
                <label>納期（オプション）</label>
                <input
                  type="text"
                  value={newMaterial.deliveryTime || ''}
                  onChange={(e) => setNewMaterial({ ...newMaterial, deliveryTime: e.target.value })}
                  placeholder="例: 2週間"
                />
              </div>
            </div>
            <div className="form-group">
              <label>担当者</label>
              <input
                type="text"
                value={newMaterial.uploadedBy || ''}
                onChange={(e) => setNewMaterial({ ...newMaterial, uploadedBy: e.target.value })}
                placeholder="田中太郎"
              />
            </div>
            <div className="form-group">
              <label>公開設定</label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={newMaterial.isPublic || false}
                  onChange={(e) => setNewMaterial({ ...newMaterial, isPublic: e.target.checked })}
                />
                チーム全体に公開する
              </label>
            </div>
            <div className="form-group">
              <label>タグ</label>
              <div className="tags-section">
                <div className="tags-list">
                  {newMaterial.tags?.map(tag => (
                    <span key={tag} className="tag-input">
                      #{tag}
                      <button onClick={() => removeTag(tag)}>×</button>
                    </span>
                  ))}
                </div>
                <button type="button" onClick={addTag} className="add-tag-btn">
                  + タグを追加
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>メモ・備考</label>
              <textarea
                value={newMaterial.notes || ''}
                onChange={(e) => setNewMaterial({ ...newMaterial, notes: e.target.value })}
                rows={3}
                placeholder="資料に関する追加情報や注意事項"
              />
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => {
                setShowMaterialModal(false);
                setEditingMaterial(null);
                setNewMaterial({
                  category: 'proposal',
                  serviceCategory: 'other',
                  fileType: 'pdf',
                  isPublic: true,
                  version: '1.0',
                  downloadCount: 0,
                  tags: [],
                  createdAt: new Date().toISOString()
                });
              }}>キャンセル</button>
              <button className="save-btn" onClick={addMaterial}>
                {editingMaterial ? '資料を更新' : '資料を追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedMaterial && (
        <div className="modal-overlay" onClick={() => setSelectedMaterial(null)}>
          <div className="modal-content material-detail-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedMaterial.title}</h2>
            <div className="material-detail-content">
              <div className="detail-section">
                <h3>基本情報</h3>
                <p><strong>説明:</strong> {selectedMaterial.description}</p>
                <p><strong>カテゴリ:</strong>
                  <span className="category-badge" style={{ backgroundColor: getCategoryColor(selectedMaterial.category) }}>
                    {getCategoryLabel(selectedMaterial.category)}
                  </span>
                </p>
                <p><strong>ファイル形式:</strong> {getFileTypeIcon(selectedMaterial.fileType)} {selectedMaterial.fileType.toUpperCase()}</p>
                <p><strong>ファイルサイズ:</strong> {selectedMaterial.fileSize}</p>
                <p><strong>バージョン:</strong> v{selectedMaterial.version}</p>
                <p><strong>担当者:</strong> {selectedMaterial.uploadedBy}</p>
                <p><strong>登録日:</strong> {selectedMaterial.uploadDate}</p>
                <p><strong>ダウンロード数:</strong> {selectedMaterial.downloadCount}回</p>
                <p><strong>公開設定:</strong> {selectedMaterial.isPublic ? '公開' : '非公開'}</p>
                {selectedMaterial.serviceCategory && (
                  <p><strong>サービスカテゴリー:</strong>
                    <span className="service-category-badge" style={{ backgroundColor: getServiceCategoryColor(selectedMaterial.serviceCategory), marginLeft: '8px' }}>
                      {getServiceCategoryLabel(selectedMaterial.serviceCategory)}
                    </span>
                  </p>
                )}
                {selectedMaterial.price && (
                  <p><strong>参考価格:</strong> ¥{selectedMaterial.price.toLocaleString()}</p>
                )}
                {selectedMaterial.deliveryTime && (
                  <p><strong>納期:</strong> {selectedMaterial.deliveryTime}</p>
                )}
                {selectedMaterial.fileName && (
                  <p><strong>ファイル名:</strong> {selectedMaterial.fileName}</p>
                )}
              </div>

              {selectedMaterial.tags.length > 0 && (
                <div className="detail-section">
                  <h3>タグ</h3>
                  <div className="tags-list">
                    {selectedMaterial.tags.map(tag => (
                      <span key={tag} className="tag">#{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedMaterial.notes && (
                <div className="detail-section">
                  <h3>メモ・備考</h3>
                  <p>{selectedMaterial.notes}</p>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setSelectedMaterial(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceMaterials;
