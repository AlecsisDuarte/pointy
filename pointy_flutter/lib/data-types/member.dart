// Generated by itsjason
// import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:async';

class Member {

  String id;
	String uid;
	String name;
	int vote = 0;

	Member({this.uid, this.name, this.vote});

  Member.fromMap(String id, Map<dynamic, dynamic> map)
      : id = id,
      uid = map['uid'],
			name = map['name'],
			vote = map['vote'] ?? 0;

  Map<String, dynamic> toMap() => {
    "id": this.id, 
    "uid": this.uid,
		"name": this.name,
		"vote": this.vote  };

  @override
  String toString() => "Member<id:$id>";

  static StreamTransformer<DocumentSnapshot, Member> getTransformer() {
    final trans = StreamTransformer.fromHandlers(
        handleData: (DocumentSnapshot snapshot, EventSink<Member> sink) {
      if (snapshot.data == null) return;

      final result = Member.fromMap(snapshot.documentID, snapshot.data);
      sink.add(result);
    });
    return trans;
  }

  static Stream<Member> getDocumentStream(Firestore firestore, String path) {
    final transformer =
        firestore.document(path).snapshots().transform(getTransformer());
    return transformer;
  }

  static Stream<Map<String, Member>> getCollectionStream(
      Firestore firestore, String path) {
    final transformer = firestore.collection(path).snapshots().transform(
        StreamTransformer.fromHandlers(handleData: handleCollectionTransform));
    return transformer;
  }

  static void handleCollectionTransform(
      QuerySnapshot snapshot, EventSink<Map<String, Member>> sink) {
    var result = Map<String, Member>();
    snapshot.documents.forEach((doc) {
      result[doc.documentID] = Member.fromMap(doc.documentID, doc.data);
    });
    sink.add(result);
  }
}
    