import { useState, useEffect } from 'react';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Shield, UserPlus, Users, Mail, Plus, Trash2, Loader2, UserCircle, Calendar, AlertTriangle } from 'lucide-react';
import { db, appId, ADMIN_EMAILS, auth } from '../config/firebase';

export default function AdminPanel({ authorizedUsers, showToast }) {
  const [newEmail, setNewEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [activeSection, setActiveSection] = useState('authorized'); // 'authorized', 'registered'

  // Kayıtlı kullanıcıları dinle
  useEffect(() => {
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'registeredUsers');
    const q = query(usersRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRegisteredUsers(users);
    });
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();

    if (!email || !email.includes('@')) {
      showToast("Geçerli bir email adresi girin", "error");
      return;
    }

    if (ADMIN_EMAILS.includes(email)) {
      showToast("Bu email zaten admin", "error");
      return;
    }

    if (authorizedUsers.some(u => u.email === email)) {
      showToast("Bu kullanıcı zaten yetkili", "error");
      return;
    }

    setIsAdding(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'authorizedUsers', email), {
        canCreate: true,
        addedAt: serverTimestamp(),
        addedBy: auth.currentUser?.email
      });
      setNewEmail('');
      showToast("Kullanıcı yetkilendirildi!");
    } catch (error) {
      console.error(error);
      showToast("Hata oluştu", "error");
    }
    setIsAdding(false);
  };

  const handleRemoveUser = async (email) => {
    if (!confirm(`${email} kullanıcısının yetkisini kaldırmak istediğinize emin misiniz?`)) return;

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'authorizedUsers', email));
      showToast("Yetki kaldırıldı");
    } catch (error) {
      console.error(error);
      showToast("Hata oluştu", "error");
    }
  };

  const handleDeleteRegisteredUser = async (user) => {
    if (!confirm(`${user.email} kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'registeredUsers', user.id));
      showToast("Kullanıcı kaydı silindi");
    } catch (error) {
      console.error(error);
      showToast("Hata oluştu", "error");
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-amber-100 text-amber-600 p-2 rounded-lg">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Admin Paneli</h1>
            <p className="text-slate-500 text-sm sm:text-base">Kullanıcıları ve yetkileri yönetin</p>
          </div>
        </div>
      </header>

      {/* Section Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveSection('authorized')}
          className={`px-4 py-2 rounded-lg font-medium transition ${activeSection === 'authorized'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          <Users size={16} className="inline mr-2" />
          Yetkili Kullanıcılar
        </button>
        <button
          onClick={() => setActiveSection('registered')}
          className={`px-4 py-2 rounded-lg font-medium transition ${activeSection === 'registered'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          <UserCircle size={16} className="inline mr-2" />
          Kayıtlı Kullanıcılar ({registeredUsers.length})
        </button>
      </div>

      {/* Authorized Users Section */}
      {activeSection === 'authorized' && (
        <>
          {/* Yeni Kullanıcı Ekleme */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 max-w-2xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <UserPlus size={20} className="text-indigo-600" />
              Yeni Kullanıcı Yetkilendir
            </h2>

            <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                  disabled={isAdding}
                />
              </div>
              <button
                type="submit"
                disabled={isAdding}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAdding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Yetkilendir
              </button>
            </form>
          </div>

          {/* Admin Listesi */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 max-w-2xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Shield size={20} className="text-amber-600" />
              Adminler (Değiştirilemez)
            </h2>

            <div className="space-y-2">
              {ADMIN_EMAILS.map(email => (
                <div key={email} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center">
                      <Shield size={18} className="text-amber-700" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{email}</p>
                      <p className="text-xs text-amber-600">Süper Admin</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Yetkili Kullanıcılar Listesi */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-2xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users size={20} className="text-indigo-600" />
              Yetkili Kullanıcılar ({authorizedUsers.length})
            </h2>

            {authorizedUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <UserPlus size={40} className="mx-auto mb-2 opacity-50" />
                <p>Henüz yetkili kullanıcı eklenmemiş</p>
              </div>
            ) : (
              <div className="space-y-2">
                {authorizedUsers.map(user => (
                  <div key={user.email} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <UserCircle size={20} className="text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{user.email}</p>
                        <p className="text-xs text-slate-500">
                          {user.addedAt ? new Date(user.addedAt.toDate()).toLocaleDateString('tr-TR') : 'Tarih bilinmiyor'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveUser(user.email)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Yetkiyi kaldır"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Registered Users Section */}
      {activeSection === 'registered' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-4xl">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <UserCircle size={20} className="text-emerald-600" />
            Kayıtlı Kullanıcılar ({registeredUsers.length})
          </h2>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2 text-amber-700 text-sm">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>Bu liste sadece email/şifre ile kayıt olan kullanıcıları gösterir. Silme işlemi sadece Firestore kaydını siler, Firebase Auth kaydını silmez.</span>
          </div>

          {registeredUsers.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <UserCircle size={40} className="mx-auto mb-2 opacity-50" />
              <p>Henüz kayıtlı kullanıcı yok</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-3 px-4 font-medium text-slate-600">İsim</th>
                    <th className="py-3 px-4 font-medium text-slate-600">Email</th>
                    <th className="py-3 px-4 font-medium text-slate-600">Kayıt Tarihi</th>
                    <th className="py-3 px-4 font-medium text-slate-600">Kayıt Türü</th>
                    <th className="py-3 px-4 font-medium text-slate-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {registeredUsers.map(user => (
                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                            <UserCircle size={16} className="text-emerald-600" />
                          </div>
                          <span className="font-medium text-slate-800">{user.displayName || '-'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{user.email}</td>
                      <td className="py-3 px-4 text-slate-500 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          {user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString('tr-TR') : '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${user.authProvider === 'email' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                          {user.authProvider === 'email' ? 'Email' : user.authProvider || 'Bilinmiyor'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleDeleteRegisteredUser(user)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Kullanıcıyı sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
