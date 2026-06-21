import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Edit, Check, X, ShieldAlert, Archive, Users, UserCheck, BookOpen, Star, User, Loader2, Ban, Camera, Save, Search, Filter, Upload, FileText, Image as ImageIcon, MessageSquarePlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

export default function Admin() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('my-books')
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  // Data States
  const [stats, setStats] = useState({ users: 0, books: 0, reviews: 0 })
  const [bookRequests, setBookRequests] = useState([]) 
  const [myBooks, setMyBooks] = useState([])
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [rejectedBooks, setRejectedBooks] = useState([])
  const [authorRequests, setAuthorRequests] = useState([])
  const [activeAuthors, setActiveAuthors] = useState([])
  const [allPublishedBooks, setAllPublishedBooks] = useState([]) 
  
  // NEW: Assignments State
  const [myAssignments, setMyAssignments] = useState([])
  const [assignModal, setAssignModal] = useState({ isOpen: false, authorId: null, authorName: '' })
  const [assignText, setAssignText] = useState('')

  // Live Books Search/Filter State
  const [liveSearchTerm, setLiveSearchTerm] = useState('')
  const [liveSelectedGenre, setLiveSelectedGenre] = useState('All')

  // Profile Data State
  const [myProfile, setMyProfile] = useState({ nickname: '', real_name: '', avatar_url: '' })
  const [avatarFile, setAvatarFile] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)

  // Form State
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ 
    title: '', author: '', genre: [], cover: null, pdf: null, series_name: '', series_order: '', synopsis: ''
  })

  const GENRE_OPTIONS = ['Fantasy', 'Romance', 'Thriller', 'Sci-Fi', 'Mystery', 'Horror', 'Dark Romance', 'Adventure', 'Non-fiction', 'History']
  const FILTER_GENRES = ['All', ...GENRE_OPTIONS]

  // --- 1. AUTH CHECK ---
  useEffect(() => {
    checkUserAndRole()
  }, [])

  async function checkUserAndRole() {
    try {
      setLoading(true)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
         navigate('/login')
         return
      }
      setUser(currentUser)

      // Fetch Role
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single()
      setRole(profile ? profile.role : 'user')
      
    } catch (error) {
      console.error("Auth check failed:", error)
    } finally {
      setLoading(false)
    }
  }

  // --- 2. FETCH DATA ---
  useEffect(() => {
    if (role && user) {
      fetchMyBooks()
      fetchMyProfile() 
      fetchMyAssignments() // Fetch assignments for the author dashboard
      
      if (role === 'super_admin') {
        fetchStats()
        fetchBookRequests()
        fetchPendingApprovals()
        fetchRejectedBooks()
        fetchAuthorRequests()
        fetchActiveAuthors()
        fetchAllPublished() 
      }
    }
  }, [role, user, activeTab]) 

  // --- 3. DYNAMIC FETCH FOR LIVE BOOKS SEARCH ---
  useEffect(() => {
    if (role === 'super_admin' && activeTab === 'published') {
        const delayDebounceFn = setTimeout(() => {
            fetchAllPublished()
        }, 500) 
        return () => clearTimeout(delayDebounceFn)
    }
  }, [liveSearchTerm, liveSelectedGenre])

  // --- 4. REAL-TIME NOTIFICATIONS (SUPER ADMIN ONLY) ---
  useEffect(() => {
    if (role !== 'super_admin') return;

    const channel = supabase.channel('admin-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'book_requests' }, () => {
        toast.success('🔔 New Book Request from a user!');
        fetchBookRequests(); // Auto-refresh the list
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'novels' }, (payload) => {
        if (payload.new.status === 'pending') {
          toast.success('📖 An Author submitted a new book for approval!');
          fetchPendingApprovals();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'review_flags' }, () => {
        toast.error('🚩 A user reported a comment!');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role]);

  // --- FETCH FUNCTIONS ---
  async function fetchMyProfile() {
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setMyProfile(data)
  }

  async function fetchMyAssignments() {
    if (!user) return
    const { data } = await supabase.from('author_assignments').select('*').eq('author_id', user.id).order('created_at', { ascending: false })
    setMyAssignments(data || [])
  }

  async function fetchStats() {
    const { count: users } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
    const { count: books } = await supabase.from('novels').select('*', { count: 'exact', head: true })
    const { count: reviews } = await supabase.from('reviews').select('*', { count: 'exact', head: true })
    setStats({ users: users || 0, books: books || 0, reviews: reviews || 0 })
  }

  async function fetchBookRequests() {
    const { data } = await supabase.from('book_requests').select('*, profiles(nickname)').eq('status', 'pending')
    setBookRequests(data || [])
  }

  async function fetchAuthorRequests() {
    const { data } = await supabase
      .from('admin_requests')
      .select('*, profiles!admin_requests_user_id_fkey(email)') 
      .eq('status', 'pending')
    setAuthorRequests(data || [])
  }

  async function fetchActiveAuthors() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'author')
    setActiveAuthors(data || [])
  }

  async function fetchMyBooks() {
    if (!user) return
    const { data } = await supabase.from('novels').select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
    setMyBooks(data || [])
  }

  async function fetchAllPublished() {
    let query = supabase.from('novels').select('*').eq('status', 'published').order('created_at', { ascending: false })

    if (liveSearchTerm) {
        query = query.or(`title.ilike.%${liveSearchTerm}%,author.ilike.%${liveSearchTerm}%`)
    }
    if (liveSelectedGenre !== 'All') {
        query = query.ilike('genre', `%${liveSelectedGenre}%`)
    }

    const { data } = await query
    setAllPublishedBooks(data || [])
  }

  async function fetchPendingApprovals() {
    const { data } = await supabase.from('novels').select('*').eq('status', 'pending')
    setPendingApprovals(data || [])
  }

  async function fetchRejectedBooks() {
    const { data } = await supabase.from('novels').select('*').eq('status', 'rejected')
    setRejectedBooks(data || [])
  }

  // --- ACTIONS ---
  async function handleUpdateProfile(e) {
    e.preventDefault()
    setSavingProfile(true)
    try {
        let newAvatarUrl = myProfile.avatar_url
        if (avatarFile) {
            const fileName = `${user.id}-${Date.now()}`
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, avatarFile)
            if (uploadError) throw uploadError
            const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
            newAvatarUrl = publicUrlData.publicUrl
        }
        const { error } = await supabase.from('profiles').update({
            nickname: myProfile.nickname,
            real_name: myProfile.real_name,
            avatar_url: newAvatarUrl
        }).eq('id', user.id)

        if (error) throw error
        toast.success("Profile updated successfully!")
        setAvatarFile(null)
        fetchMyProfile()
    } catch (error) {
        toast.error("Error updating profile")
        console.error(error)
    } finally {
        setSavingProfile(false)
    }
  }

  async function handleRevokeAccess(userId) {
    if(!confirm("Are you sure? This user will lose Author access.")) return
    await supabase.from('profiles').update({ role: 'user' }).eq('id', userId)
    await supabase.from('admin_requests').update({ status: 'rejected' }).eq('user_id', userId)
    toast.success("Access revoked")
    fetchActiveAuthors()
  }

  async function handleBookRequest(reqId, status) {
    await supabase.from('book_requests').update({ status }).eq('id', reqId)
    toast.success(`Request ${status}`)
    fetchBookRequests()
  }

  async function handleAuthorRequest(requestId, userId, action) {
    await supabase.from('admin_requests').update({ status: action }).eq('id', requestId)
    if (action === 'approved') await supabase.from('profiles').update({ role: 'author' }).eq('id', userId)
    toast.success(`User ${action}`)
    fetchAuthorRequests()
    fetchActiveAuthors()
  }

  async function updateBookStatus(bookId, newStatus) {
    await supabase.from('novels').update({ status: newStatus }).eq('id', bookId)
    toast.success(`Book ${newStatus}`)
    fetchPendingApprovals()
    fetchRejectedBooks()
    fetchAllPublished() 
  }

  async function deletePermanently(bookId) {
    if(!confirm("Delete forever? This action cannot be undone.")) return
    await supabase.from('novels').delete().eq('id', bookId)
    toast.success("Deleted")
    fetchRejectedBooks()
    fetchAllPublished() 
  }

  async function handleDeleteBook(bookId) {
    if(!confirm("Delete this book?")) return
    await supabase.from('novels').delete().eq('id', bookId)
    toast.success("Book deleted")
    fetchMyBooks()
  }

  // --- ASSIGNMENT ACTIONS ---
  async function submitAssignment(e) {
    e.preventDefault()
    if(!assignText.trim()) return
    const { error } = await supabase.from('author_assignments').insert({
      author_id: assignModal.authorId,
      prompt: assignText
    })
    if(error) toast.error("Failed to assign book")
    else {
       toast.success(`Book assigned to ${assignModal.authorName}!`)
       setAssignModal({ isOpen: false, authorId: null, authorName: '' })
       setAssignText('')
    }
  }

  async function markAssignmentComplete(id) {
    await supabase.from('author_assignments').update({ status: 'completed' }).eq('id', id)
    toast.success("Marked as Completed!")
    fetchMyAssignments()
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!user) return
    setUploading(true)
    try {
        let coverUrl = null
        let pdfUrl = null

        if (formData.cover) {
            const coverName = `${Date.now()}-${formData.cover.name}`
            await supabase.storage.from('covers').upload(coverName, formData.cover)
            coverUrl = supabase.storage.from('covers').getPublicUrl(coverName).data.publicUrl
        }
        if (formData.pdf) {
            const pdfName = `${Date.now()}-${formData.pdf.name}`
            await supabase.storage.from('pdfs').upload(pdfName, formData.pdf)
            pdfUrl = supabase.storage.from('pdfs').getPublicUrl(pdfName).data.publicUrl
        }

        const bookData = {
            title: formData.title,
            author: formData.author,
            genre: formData.genre.join(', '),
            series_name: formData.series_name || null,
            series_order: formData.series_order || null,
            synopsis: formData.synopsis || '',
            ...(coverUrl && { cover_url: coverUrl }),
            ...(pdfUrl && { pdf_url: pdfUrl }),
        }

        if (editingId) {
            const { error } = await supabase.from('novels').update(bookData).eq('id', editingId)
            if (error) throw error
            toast.success("Book Updated!")
        } else {
            const initialStatus = role === 'super_admin' ? 'published' : 'pending'
            const { error } = await supabase.from('novels').insert({
                ...bookData,
                owner_id: user.id,
                status: initialStatus,
                cover_url: coverUrl,
                pdf_url: pdfUrl
            })
            if (error) throw error
            toast.success(role === 'super_admin' ? "Book Published!" : "Submitted for Review")
        }

        setEditingId(null)
        setFormData({ title: '', author: '', genre: [], cover: null, pdf: null, series_name: '', series_order: '', synopsis: '' })
        fetchMyBooks()

    } catch (error) {
        toast.error("Error: " + error.message)
    } finally {
        setUploading(false)
    }
  }

  function handleGenreChange(e) {
    const value = e.target.value
    setFormData(prev => {
      const genres = prev.genre.includes(value) 
        ? prev.genre.filter(g => g !== value) 
        : [...prev.genre, value]
      return { ...prev, genre: genres }
    })
  }

  function handleEditClick(book) {
    setEditingId(book.id)
    setFormData({
      title: book.title,
      author: book.author,
      genre: book.genre ? book.genre.split(', ') : [],
      series_name: book.series_name || '',
      series_order: book.series_order || '',
      synopsis: book.synopsis || '',
      cover: null, pdf: null 
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <div className="h-screen flex items-center justify-center text-purple-600"><Loader2 className="w-10 h-10 animate-spin" /></div>

  if (role !== 'super_admin' && role !== 'author') {
    return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white p-4">
            <h1 className="text-2xl font-bold mb-2">Access Restricted</h1>
            <p className="text-gray-500 mb-6">You are logged in as <strong>{user?.email}</strong> (Role: {role})</p>
            <button onClick={() => navigate('/')} className="mt-4 bg-purple-600 text-white px-6 py-2 rounded-lg font-bold">Go Home</button>
        </div>
    )
  }

  return (
    <div className="min-h-screen p-6 md:p-8 transition-colors bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white relative">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* --- SUPER ADMIN DASHBOARD HEADER --- */}
        {role === 'super_admin' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full mr-4"><User className="w-8 h-8 text-blue-600 dark:text-blue-400" /></div>
                <div><p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase">Total Users</p><p className="text-3xl font-bold">{stats.users}</p></div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-full mr-4"><BookOpen className="w-8 h-8 text-purple-600 dark:text-purple-400" /></div>
                <div><p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase">Total Books</p><p className="text-3xl font-bold">{stats.books}</p></div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-full mr-4"><Star className="w-8 h-8 text-yellow-600 dark:text-yellow-400" /></div>
                <div><p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase">Total Reviews</p><p className="text-3xl font-bold">{stats.reviews}</p></div>
              </div>
          </div>
        )}

        {/* --- PENDING BOOK REQUESTS FROM USERS --- */}
        {role === 'super_admin' && bookRequests.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-6 flex items-center text-gray-800 dark:text-white">
               <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-full mr-3">
                  <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400"/>
               </div>
               Pending Book Requests <span className="ml-2 text-gray-400 font-normal">({bookRequests.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bookRequests.map(req => (
                <div key={req.id} className="bg-gray-50 dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition">
                  <div className="mb-4">
                      <h3 className="font-bold text-lg text-gray-800 dark:text-white leading-tight mb-1">
                        {req.title || req.book_title || "Unknown Title"}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        by {req.author || req.author_name || "Unknown Author"}
                      </p>
                  </div>
                  
                  <div className="flex items-center mb-4">
                     <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-full">
                        Requested by: {req.profiles?.nickname || 'User'}
                     </span>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => handleBookRequest(req.id, 'done')} className="flex-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 py-2.5 rounded-xl text-sm font-bold hover:bg-green-200 dark:hover:bg-green-900/50 transition">
                        Done
                    </button>
                    <button onClick={() => handleBookRequest(req.id, 'rejected')} className="flex-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 py-2.5 rounded-xl text-sm font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition">
                        Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TABS --- */}
        <div className="flex space-x-6 border-b border-gray-200 dark:border-gray-700 pb-2 overflow-x-auto">
          <button onClick={() => setActiveTab('my-books')} className={`pb-2 px-2 text-lg font-bold transition ${activeTab === 'my-books' ? 'text-purple-600 border-b-2 border-purple-600 dark:text-purple-400 dark:border-purple-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>My Books</button>
          
          <button onClick={() => setActiveTab('profile')} className={`pb-2 px-2 text-lg font-bold transition flex items-center ${activeTab === 'profile' ? 'text-pink-600 border-b-2 border-pink-600 dark:text-pink-400 dark:border-pink-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
             My Profile
          </button>

          {role === 'super_admin' && (
            <>
              <button onClick={() => setActiveTab('approvals')} className={`pb-2 px-2 text-lg font-bold transition flex items-center ${activeTab === 'approvals' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                Approvals <span className="ml-2 bg-orange-100 text-orange-800 text-xs px-2 rounded-full">{pendingApprovals.length}</span>
              </button>

              <button onClick={() => setActiveTab('published')} className={`pb-2 px-2 text-lg font-bold transition flex items-center ${activeTab === 'published' ? 'text-green-500 border-b-2 border-green-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                Live Books <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 rounded-full">{allPublishedBooks.length}</span>
              </button>

              <button onClick={() => setActiveTab('rejected')} className={`pb-2 px-2 text-lg font-bold transition flex items-center ${activeTab === 'rejected' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                Rejected <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 rounded-full">{rejectedBooks.length}</span>
              </button>
              <button onClick={() => setActiveTab('requests')} className={`pb-2 px-2 text-lg font-bold transition flex items-center ${activeTab === 'requests' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                Requests <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 rounded-full">{authorRequests.length}</span>
              </button>
              <button onClick={() => setActiveTab('authors')} className={`pb-2 px-2 text-lg font-bold transition flex items-center ${activeTab === 'authors' ? 'text-teal-500 border-b-2 border-teal-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                Authors <span className="ml-2 bg-teal-100 text-teal-800 text-xs px-2 rounded-full">{activeAuthors.length}</span>
              </button>
            </>
          )}
        </div>

        {/* --- TAB: MY BOOKS (UPDATED UI) --- */}
        {activeTab === 'my-books' && (
          <div className="space-y-8">

            {/* NEW: MY ASSIGNMENTS SECTION */}
            {myAssignments.length > 0 && (
               <div className="bg-blue-50 dark:bg-blue-900/20 p-6 md:p-8 rounded-3xl border border-blue-100 dark:border-blue-800">
                 <h2 className="text-xl font-bold mb-6 flex items-center text-blue-800 dark:text-blue-300">
                   <MessageSquarePlus className="mr-3 w-6 h-6"/> Admin Assignments
                 </h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myAssignments.map(assign => (
                       <div key={assign.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                          <p className="text-gray-800 dark:text-gray-200 mb-6 text-sm leading-relaxed">{assign.prompt}</p>
                          <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-700 pt-4 mt-auto">
                             <span className={`text-[10px] px-3 py-1.5 rounded-full uppercase font-bold tracking-wider ${assign.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                               {assign.status}
                             </span>
                             {assign.status === 'pending' && (
                               <button onClick={() => markAssignmentComplete(assign.id)} className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">Mark as Done</button>
                             )}
                          </div>
                       </div>
                    ))}
                 </div>
               </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* --- NEW SOFT UPLOAD FORM --- */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 h-fit sticky top-24">
                <h2 className="text-2xl font-bold mb-6 flex items-center text-gray-800 dark:text-white">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-full mr-3">
                        <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    {editingId ? 'Edit Book Details' : 'Upload New Book'}
                </h2>
                
                <form onSubmit={handleUpload} className="space-y-5">
                  
                  {/* Title */}
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Book Title</label>
                      <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} 
                          className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 focus:bg-white dark:focus:bg-gray-800 transition-all outline-none font-medium text-gray-800 dark:text-white placeholder-gray-400" 
                          placeholder="e.g. The Midnight Library" 
                      />
                  </div>

                  {/* Author & Genres */}
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Author</label>
                      <input required value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} 
                          className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 focus:bg-white dark:focus:bg-gray-800 transition-all outline-none font-medium text-gray-800 dark:text-white placeholder-gray-400" 
                          placeholder="Author Name" 
                      />
                  </div>

                  {/* Modern Chip Selection for Genres */}
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Select Genres</label>
                      <div className="flex flex-wrap gap-2">
                          {GENRE_OPTIONS.map(g => (
                              <label key={g} className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer transition-all border ${
                                  formData.genre.includes(g) 
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-md transform scale-105' 
                                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}>
                                  <input type="checkbox" value={g} checked={formData.genre.includes(g)} onChange={handleGenreChange} className="hidden"/>
                                  {g}
                              </label>
                          ))}
                      </div>
                  </div>

                  {/* Synopsis */}
                  <div className="space-y-1">
                       <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Synopsis</label>
                       <textarea value={formData.synopsis} onChange={e => setFormData({...formData, synopsis: e.target.value})} 
                          className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 focus:bg-white dark:focus:bg-gray-800 transition-all outline-none font-medium text-gray-800 dark:text-white placeholder-gray-400 h-32 resize-none leading-relaxed" 
                          placeholder="Write a compelling summary..." 
                       />
                  </div>

                  {/* Series Info */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Series Name (Optional)</label>
                        <input value={formData.series_name} onChange={e => setFormData({...formData, series_name: e.target.value})} 
                          className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 focus:bg-white dark:focus:bg-gray-800 transition-all outline-none font-medium text-gray-800 dark:text-white placeholder-gray-400" 
                          placeholder="e.g. Harry Potter" 
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Vol #</label>
                        <input type="number" value={formData.series_order} onChange={e => setFormData({...formData, series_order: e.target.value})} 
                          className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 focus:bg-white dark:focus:bg-gray-800 transition-all outline-none font-medium text-gray-800 dark:text-white placeholder-gray-400 text-center" 
                          placeholder="1" 
                        />
                    </div>
                  </div>

                  {/* File Uploads (Soft Style) */}
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Cover Image</label>
                          <div className="relative">
                               <input type="file" accept="image/*" onChange={e => setFormData({...formData, cover: e.target.files[0]})} 
                                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                                  file:mr-4 file:py-2.5 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-xs file:font-bold
                                  file:bg-purple-50 file:text-purple-700
                                  hover:file:bg-purple-100 dark:file:bg-purple-900/30 dark:file:text-purple-300
                                  cursor-pointer"
                                  required={!editingId}
                               />
                          </div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">PDF File</label>
                          <div className="relative">
                               <input type="file" accept="application/pdf" onChange={e => setFormData({...formData, pdf: e.target.files[0]})} 
                                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                                  file:mr-4 file:py-2.5 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-xs file:font-bold
                                  file:bg-red-50 file:text-red-700
                                  hover:file:bg-red-100 dark:file:bg-red-900/30 dark:file:text-red-300
                                  cursor-pointer"
                                  required={!editingId}
                               />
                          </div>
                      </div>
                  </div>

                  {/* Action Button */}
                  <button disabled={uploading} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center">
                      {uploading ? <Loader2 className="animate-spin mr-2"/> : <Upload className="mr-2 w-5 h-5"/>}
                      {uploading ? 'Processing...' : (editingId ? 'Update Book' : 'Publish Novel')}
                  </button>
                  {editingId && <button type="button" onClick={() => {setEditingId(null); setFormData({ title: '', author: '', genre: [], cover: null, pdf: null, series_name: '', series_order: '', synopsis: '' })}} className="w-full text-gray-500 dark:text-gray-400 text-sm hover:text-red-500 transition">Cancel Editing</button>}
                </form>
              </div>

              {/* --- MANAGE LIBRARY --- */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 h-[800px] flex flex-col">
                 <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Manage Library <span className="text-gray-400 ml-2 text-lg font-normal">({myBooks.length})</span></h2>
                 <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                   {myBooks.map(book => (
                     <div key={book.id} className="flex items-start justify-between bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 group hover:border-purple-200 dark:hover:border-purple-800 transition-all">
                        <div className="flex gap-4">
                          <img src={book.cover_url} className="w-16 h-24 object-cover rounded-lg shadow-sm" />
                          <div>
                             <h3 className="font-bold text-lg text-gray-800 dark:text-white leading-tight">{book.title}</h3>
                             <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{book.author}</p>
                             <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase font-bold tracking-wider ${book.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>{book.status}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all">
                           <button onClick={() => handleEditClick(book)} className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:text-blue-600 transition text-gray-400"><Edit className="w-4 h-4"/></button>
                           <button onClick={() => handleDeleteBook(book.id)} className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:text-red-600 transition text-gray-400"><Trash2 className="w-4 h-4"/></button>
                        </div>
                     </div>
                   ))}
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB: MY PROFILE (UPDATED THEME) --- */}
        {activeTab === 'profile' && (
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-2xl border border-pink-100 dark:border-pink-900/30 shadow-xl">
                <h2 className="text-2xl font-bold mb-8 flex items-center text-gray-800 dark:text-white"><User className="mr-3 text-pink-500"/> Edit My Profile</h2>
                
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                    {/* AVATAR UPLOAD */}
                    <div className="flex flex-col items-center mb-6">
                        <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white dark:border-gray-700 shadow-xl mb-4 group ring-4 ring-pink-50 dark:ring-gray-800">
                            {avatarFile ? (
                                <img src={URL.createObjectURL(avatarFile)} className="w-full h-full object-cover" />
                            ) : myProfile.avatar_url ? (
                                <img src={myProfile.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-400"><User className="w-12 h-12"/></div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center backdrop-blur-[2px]">
                                <Camera className="text-white w-8 h-8"/>
                            </div>
                            <input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Tap photo to change</p>
                    </div>

                    {/* TEXT FIELDS */}
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Nickname</label>
                            <input value={myProfile.nickname || ''} onChange={e => setMyProfile({...myProfile, nickname: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-pink-200 dark:focus:ring-pink-900 transition-all outline-none font-medium text-gray-800 dark:text-white" placeholder="e.g. BookLover99"/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Real Name (Optional)</label>
                            <input value={myProfile.real_name || ''} onChange={e => setMyProfile({...myProfile, real_name: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-pink-200 dark:focus:ring-pink-900 transition-all outline-none font-medium text-gray-800 dark:text-white" placeholder="Your Real Name"/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Email</label>
                            <input value={user.email} disabled className="w-full p-4 bg-gray-100 dark:bg-gray-800/50 border-none rounded-2xl text-gray-400 font-medium cursor-not-allowed"/>
                        </div>
                    </div>

                    <button disabled={savingProfile} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-4 rounded-2xl transition flex items-center justify-center shadow-lg hover:shadow-xl mt-4">
                        {savingProfile ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2 w-5 h-5"/>}
                        {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
                    </button>
                </form>
            </div>
        )}

        {/* --- TAB: LIVE BOOKS (SUPER ADMIN DELETE POWER) --- */}
        {activeTab === 'published' && (
          <div className="space-y-6">
             {/* SEARCH & FILTER BAR */}
             <div className="flex flex-col md:flex-row gap-4">
                 <div className="relative flex-1">
                    <Search className="absolute left-4 top-4 text-gray-400 w-5 h-5"/>
                    <input 
                       type="text" 
                       placeholder="Search live books..."
                       value={liveSearchTerm}
                       onChange={e => setLiveSearchTerm(e.target.value)}
                       className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border-none rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-900 transition text-gray-800 dark:text-white"
                    />
                 </div>
                 <div className="relative">
                    <Filter className="absolute left-4 top-4 text-gray-400 w-5 h-5"/>
                    <select
                       value={liveSelectedGenre}
                       onChange={e => setLiveSelectedGenre(e.target.value)}
                       className="pl-12 pr-8 py-4 bg-white dark:bg-gray-800 border-none rounded-2xl shadow-sm outline-none cursor-pointer w-full md:w-56 appearance-none text-gray-800 dark:text-white font-medium focus:ring-2 focus:ring-green-200 dark:focus:ring-green-900"
                    >
                        {FILTER_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                 </div>
             </div>

             {/* BOOKS GRID */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allPublishedBooks.map(book => (
                <div key={book.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 flex justify-between items-start shadow-sm hover:shadow-md transition">
                    <div className="flex gap-4">
                        <img src={book.cover_url} className="w-16 h-24 object-cover rounded-lg shadow-sm" />
                        <div>
                            <h3 className="font-bold text-gray-800 dark:text-white text-lg leading-tight mb-1">{book.title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{book.author}</p>
                            <span className="text-[10px] px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold rounded-full tracking-wide">LIVE</span>
                        </div>
                    </div>
                    {/* SUPER ADMIN DELETE BUTTON */}
                    <button onClick={() => deletePermanently(book.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition"><Trash2 className="w-5 h-5"/></button>
                </div>
                ))}
                {allPublishedBooks.length === 0 && <div className="text-center col-span-full py-20 text-gray-400 dark:text-gray-600 font-medium text-lg">No books found matching criteria.</div>}
             </div>
          </div>
        )}

        {/* --- TAB: APPROVALS --- */}
        {activeTab === 'approvals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingApprovals.map(book => (
              <div key={book.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-orange-100 dark:border-orange-900/30 flex justify-between items-center shadow-sm">
                 <div className="flex items-center gap-4">
                    <img src={book.cover_url} className="w-16 h-24 object-cover rounded-lg" />
                    <div><h3 className="font-bold text-lg text-gray-800 dark:text-white">{book.title}</h3><p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{book.author}</p><p className="text-xs text-orange-500 font-bold bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full w-fit">Awaiting Approval</p></div>
                 </div>
                 <div className="flex gap-3">
                    <button onClick={() => updateBookStatus(book.id, 'published')} className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-3 rounded-xl hover:bg-green-200 transition"><Check className="w-5 h-5"/></button>
                    <button onClick={() => updateBookStatus(book.id, 'rejected')} className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl hover:bg-red-200 transition"><X className="w-5 h-5"/></button>
                 </div>
              </div>
            ))}
            {pendingApprovals.length === 0 && <p className="text-gray-500 text-center py-10">No pending approvals.</p>}
          </div>
        )}

        {/* --- TAB: REJECTED --- */}
        {activeTab === 'rejected' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {rejectedBooks.map(book => (
               <div key={book.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-red-100 dark:border-red-900/30 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-24 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center"><Archive className="text-gray-400"/></div>
                     <div><h3 className="font-bold text-lg text-gray-800 dark:text-white">{book.title}</h3><p className="text-xs text-red-500 font-bold mt-1 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full w-fit">Rejected</p></div>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => updateBookStatus(book.id, 'pending')} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-200 transition">Restore</button>
                     <button onClick={() => deletePermanently(book.id)} className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-700 transition">Delete</button>
                  </div>
               </div>
             ))}
          </div>
        )}

        {/* --- TAB: AUTHOR REQUESTS --- */}
        {activeTab === 'requests' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {authorRequests.length === 0 && <p className="text-gray-500 text-center py-10">No pending author requests.</p>}
             {authorRequests.map(req => (
               <div key={req.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex justify-between items-center shadow-sm">
                  <div>
                     <h3 className="font-bold text-gray-800 dark:text-white text-lg">{req.profiles?.email || "Unknown User"}</h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Requested: {new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => handleAuthorRequest(req.id, req.user_id, 'approved')} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center shadow-lg shadow-green-200 dark:shadow-none hover:bg-green-700 transition"><UserCheck className="w-4 h-4 mr-2"/> Approve</button>
                     <button onClick={() => handleAuthorRequest(req.id, req.user_id, 'rejected')} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-200 transition">Reject</button>
                  </div>
               </div>
             ))}
          </div>
        )}

        {/* --- TAB: AUTHORS LIST --- */}
        {activeTab === 'authors' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {activeAuthors.length === 0 && <p className="text-gray-500 text-center col-span-full py-10">No active authors found.</p>}
             {activeAuthors.map(author => (
               <div key={author.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-teal-100 dark:border-teal-900/30 flex flex-col justify-between shadow-sm hover:shadow-md transition">
                  <div className="flex items-center mb-6">
                     <img src={author.avatar_url || "https://via.placeholder.com/150"} className="w-14 h-14 rounded-full object-cover mr-4 bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-600 shadow-sm"/>
                     <div>
                       <h3 className="font-bold text-lg text-gray-800 dark:text-white leading-tight">{author.real_name || author.nickname || "No Name"}</h3>
                       <p className="text-sm text-gray-500 dark:text-gray-400">{author.email}</p>
                       <p className="text-[10px] text-teal-600 dark:text-teal-400 mt-1 uppercase font-bold tracking-wider bg-teal-50 dark:bg-teal-900/30 px-2 py-1 rounded-full w-fit">Approved Author</p>
                     </div>
                  </div>
                  <div className="flex gap-2 w-full">
                     <button onClick={() => setAssignModal({isOpen: true, authorId: author.id, authorName: author.nickname || author.real_name || 'Author'})} className="flex-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-transparent py-3 rounded-xl flex items-center justify-center transition font-bold text-sm">
                        <MessageSquarePlus className="w-4 h-4 mr-2"/> Assign Book
                     </button>
                     <button onClick={() => handleRevokeAccess(author.id)} className="flex-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-transparent py-3 rounded-xl flex items-center justify-center transition font-bold text-sm">
                       <Ban className="w-4 h-4 mr-2"/> Revoke
                     </button>
                  </div>
               </div>
             ))}
          </div>
        )}

      </div>

      {/* --- ASSIGNMENT MODAL --- */}
      {assignModal.isOpen && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 w-full max-w-md shadow-2xl">
               <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Assign Book to {assignModal.authorName}</h3>
               <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Describe the book, theme, or series you want them to write.</p>
               <form onSubmit={submitAssignment}>
                  <textarea 
                     value={assignText} 
                     onChange={e => setAssignText(e.target.value)} 
                     className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 mb-6 h-32 resize-none text-gray-800 dark:text-white"
                     placeholder="e.g. Please write a dark romance set in a Victorian boarding school..."
                     required
                  />
                  <div className="flex gap-3">
                     <button type="button" onClick={() => setAssignModal({isOpen: false, authorId: null, authorName: ''})} className="flex-1 py-3 font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition">Cancel</button>
                     <button type="submit" className="flex-1 py-3 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition">Send Request</button>
                  </div>
               </form>
            </div>
         </div>
      )}

    </div>
  )
}
